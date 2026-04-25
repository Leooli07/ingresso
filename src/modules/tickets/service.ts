import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

import { signQrPayload } from "../../utils/qr.js";

export async function generateTicketsForOrder(
  app: FastifyInstance,
  orderId: string,
) {
  const existing = await app.pg.query<{ total: number }>(
    `
    SELECT COUNT(*)::int AS total
    FROM tickets
    WHERE order_id = $1
    `,
    [orderId],
  );

  if (Number(existing.rows[0]?.total ?? 0) > 0) {
    return;
  }

  const orderResult = await app.pg.query<{
    id: string;
    tenant_id: string;
    customer_id: string;
    customer_name: string;
    customer_email: string | null;
  }>(
    `
    SELECT *
    FROM orders
    WHERE id = $1
    LIMIT 1
    `,
    [orderId],
  );

  const order = orderResult.rows[0];

  if (!order) {
    throw new Error("Pedido nao encontrado");
  }

  const itemsResult = await app.pg.query<{
    lot_id: string;
    quantity: number;
    session_id: string;
    event_id: string;
  }>(
    `
    SELECT
      oi.lot_id,
      oi.quantity,
      l.session_id,
      s.event_id
    FROM order_items oi
    JOIN lots l ON l.id = oi.lot_id
    JOIN sessions s ON s.id = l.session_id
    WHERE oi.order_id = $1
    `,
    [orderId],
  );

  for (const item of itemsResult.rows) {
    for (let index = 0; index < Number(item.quantity); index += 1) {
      const ticketId = crypto.randomUUID();
      const code = `TKT-${ticketId.slice(0, 8).toUpperCase()}`;

      const qrPayload = signQrPayload({
        ticketId,
        orderId: order.id,
        customerId: order.customer_id,
        lotId: item.lot_id,
        sessionId: item.session_id,
        eventId: item.event_id,
      });

      await app.pg.query(
        `
        INSERT INTO tickets (
          id,
          tenant_id,
          order_id,
          customer_id,
          lot_id,
          session_id,
          event_id,
          attendee_name,
          attendee_email,
          code,
          qr_payload,
          qr_code_payload,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, 'valid')
        `,
        [
          ticketId,
          order.tenant_id,
          order.id,
          order.customer_id,
          item.lot_id,
          item.session_id,
          item.event_id,
          Number(item.quantity) === 1
            ? order.customer_name
            : `${order.customer_name} ${index + 1}`,
          order.customer_email,
          code,
          qrPayload,
        ],
      );
    }

    await app.pg.query(
      `
      UPDATE lots
      SET sold = sold + $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [Number(item.quantity), item.lot_id],
    );
  }
}
