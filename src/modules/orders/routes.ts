import type { FastifyInstance } from "fastify";

export async function registerOrderRoutes(app: FastifyInstance) {
  app.get("/:id", async (req, reply) => {
    const params = req.params as { id: string };
    const query = req.query as { email?: string };

    if (!query.email) {
      return reply.status(400).send({
        error: "email e obrigatorio",
      });
    }

    const orderResult = await app.pg.query(
      `
      SELECT
        o.id,
        o.tenant_id,
        o.customer_id,
        o.total,
        o.status,
        o.created_at,
        o.expires_at,
        c.name AS customer_name,
        c.email AS customer_email,
        c.phone AS customer_phone
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
        AND c.email = $2
      LIMIT 1
      `,
      [params.id, query.email],
    );

    const order = orderResult.rows[0];

    if (!order) {
      return reply.status(404).send({
        error: "Pedido nao encontrado",
      });
    }

    const itemsResult = await app.pg.query(
      `
      SELECT
        oi.id,
        oi.lot_id,
        oi.quantity,
        oi.price,
        l.name AS lot_name,
        s.id AS session_id,
        s.starts_at AS session_starts_at,
        e.id AS event_id,
        e.title AS event_title
      FROM order_items oi
      JOIN lots l ON l.id = oi.lot_id
      JOIN sessions s ON s.id = l.session_id
      JOIN events e ON e.id = s.event_id
      WHERE oi.order_id = $1
      ORDER BY oi.id ASC
      `,
      [order.id],
    );

    const paymentsResult = await app.pg.query(
      `
      SELECT
        id,
        provider,
        provider_id,
        status,
        created_at,
        updated_at
      FROM payments
      WHERE order_id = $1
      ORDER BY created_at DESC
      `,
      [order.id],
    );

    const ticketsResult = await app.pg.query(
      `
      SELECT
        id,
        status,
        created_at,
        used_at
      FROM tickets
      WHERE order_id = $1
      ORDER BY created_at ASC
      `,
      [order.id],
    );

    return {
      order: {
        id: order.id,
        tenantId: order.tenant_id,
        total: order.total,
        status: order.status,
        createdAt: order.created_at,
        expiresAt: order.expires_at,
        customer: {
          id: order.customer_id,
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone,
        },
      },
      items: itemsResult.rows.map((item) => ({
        ...item,
        session_starts_at: item.session_starts_at?.toISOString?.() ?? item.session_starts_at,
      })),
      payments: paymentsResult.rows.map((payment) => ({
        ...payment,
        created_at: payment.created_at?.toISOString?.() ?? payment.created_at,
        updated_at: payment.updated_at?.toISOString?.() ?? payment.updated_at,
      })),
      tickets: ticketsResult.rows.map((ticket) => ({
        ...ticket,
        created_at: ticket.created_at?.toISOString?.() ?? ticket.created_at,
        used_at: ticket.used_at?.toISOString?.() ?? ticket.used_at,
      })),
    };
  });
}
