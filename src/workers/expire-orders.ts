import type { FastifyInstance } from "fastify";

export async function expireOrders(app: FastifyInstance) {
  const result = await app.pg.query(
    `
    SELECT id
    FROM orders
    WHERE status = 'reserved'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    `,
  );

  let expiredOrders = 0;

  for (const order of result.rows) {
    const itemsResult = await app.pg.query(
      `
      SELECT lot_id, quantity
      FROM order_items
      WHERE order_id = $1
      `,
      [order.id],
    );

    const updateResult = await app.pg.query(
      `
      UPDATE orders
      SET status = 'expired'
      WHERE id = $1
        AND status = 'reserved'
      `,
      [order.id],
    );

    if (updateResult.rowCount === 0) {
      continue;
    }

    expiredOrders += 1;

    for (const item of itemsResult.rows) {
      await app.redis.incrby(`lot:${item.lot_id}:stock`, Number(item.quantity));
    }
  }

  return {
    expiredOrders,
  };
}
