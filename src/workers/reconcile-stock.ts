import type { FastifyInstance } from "fastify";

export async function reconcileStock(app: FastifyInstance) {
  const result = await app.pg.query(
    `
    SELECT
      l.id,
      l.stock,
      l.sold,
      COALESCE(SUM(
        CASE
          WHEN o.status = 'reserved'
           AND o.expires_at > NOW()
          THEN oi.quantity
          ELSE 0
        END
      ), 0)::int AS reserved_quantity
    FROM lots l
    LEFT JOIN order_items oi ON oi.lot_id = l.id
    LEFT JOIN orders o ON o.id = oi.order_id
    GROUP BY l.id, l.stock, l.sold
    `,
  );

  for (const lot of result.rows) {
    const available =
      Number(lot.stock) -
      Number(lot.sold) -
      Number(lot.reserved_quantity);

    await app.redis.set(`lot:${lot.id}:stock`, String(Math.max(available, 0)));
  }

  return {
    reconciledLots: result.rows.length,
  };
}
