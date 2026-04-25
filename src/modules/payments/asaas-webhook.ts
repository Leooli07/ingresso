import type { FastifyInstance } from "fastify";

import { generateTicketsForOrder } from "../tickets/service.js";

export async function asaasWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/asaas", async (req, reply) => {
    const body = req.body as {
      event?: string;
      payment?: {
        id?: string;
      };
    };

    const event = body?.event;
    const providerPaymentId = body?.payment?.id;

    if (!event || !providerPaymentId) {
      return reply.status(400).send({
        error: "Webhook invalido",
      });
    }

    const lockKey = `webhook:asaas:${providerPaymentId}:${event}`;
    const locked = await app.redis.set(lockKey, "1", "NX", "EX", 86400);

    if (!locked) {
      return {
        ok: true,
        duplicated: true,
      };
    }

    const paymentResult = await app.pg.query<{
      id: string;
      order_id: string;
    }>(
      `
      SELECT *
      FROM payments
      WHERE provider = 'asaas'
        AND provider_id = $1
      LIMIT 1
      `,
      [providerPaymentId],
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
      return reply.status(404).send({
        error: "Pagamento nao encontrado",
      });
    }

    await app.pg.query(
      `
      UPDATE payments
      SET payload = $1,
          updated_at = NOW()
      WHERE id = $2
      `,
      [JSON.stringify(body), payment.id],
    );

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const orderResult = await app.pg.query<{ id: string; status: string }>(
        `
        SELECT *
        FROM orders
        WHERE id = $1
        LIMIT 1
        `,
        [payment.order_id],
      );

      const order = orderResult.rows[0];

      if (!order) {
        return reply.status(404).send({
          error: "Pedido nao encontrado",
        });
      }

      if (order.status !== "paid") {
        await app.pg.query(
          `
          UPDATE orders
          SET status = 'paid'
          WHERE id = $1
          `,
          [order.id],
        );

        await app.pg.query(
          `
          UPDATE payments
          SET status = 'confirmed',
              updated_at = NOW()
          WHERE id = $1
          `,
          [payment.id],
        );

        await generateTicketsForOrder(app, order.id);
      }

      return {
        ok: true,
        status: "paid",
      };
    }

    if (
      event === "PAYMENT_OVERDUE" ||
      event === "PAYMENT_DELETED" ||
      event === "PAYMENT_REFUNDED"
    ) {
      await app.pg.query(
        `
        UPDATE payments
        SET status = 'failed',
            updated_at = NOW()
        WHERE id = $1
        `,
        [payment.id],
      );

      return {
        ok: true,
        status: "failed",
      };
    }

    return {
      ok: true,
      ignored: true,
      event,
    };
  });
}
