import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

import { createPixPaymentAsaas } from "./asaas.js";
import { generateTicketsForOrder } from "../tickets/service.js";

export async function paymentsRoutes(app: FastifyInstance) {
  app.post("/payments/asaas/pix", async (req, reply) => {
    const body = req.body as {
      orderId?: string;
    };

    if (!body?.orderId) {
      return reply.status(400).send({
        error: "orderId e obrigatorio",
      });
    }

    const orderResult = await app.pg.query<{
      id: string;
      tenant_id: string;
      total: number;
      status: string;
      customer_name?: string;
    }>(
      `
      SELECT
        o.*,
        c.name AS customer_name
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
      LIMIT 1
      `,
      [body.orderId],
    );

    const order = orderResult.rows[0];

    if (!order) {
      return reply.status(404).send({
        error: "Pedido nao encontrado",
      });
    }

    if (order.status !== "reserved" && order.status !== "pending_payment") {
      return reply.status(400).send({
        error: "Pedido nao esta apto para pagamento",
        status: order.status,
      });
    }

    try {
      const payment = await createPixPaymentAsaas(app, {
        id: order.id,
        total: order.total,
        customer_name: order.customer_name,
      });

      const paymentId = crypto.randomUUID();

      await app.pg.query(
        `
        INSERT INTO payments (
          id,
          tenant_id,
          order_id,
          provider,
          provider_id,
          status,
          payload
        )
        VALUES ($1, $2, $3, 'asaas', $4, 'pending', $5)
        `,
        [
          paymentId,
          order.tenant_id,
          order.id,
          payment.id ?? null,
          JSON.stringify(payment),
        ],
      );

      await app.pg.query(
        `
        UPDATE orders
        SET status = 'pending_payment'
        WHERE id = $1
        `,
        [order.id],
      );

      return {
        orderId: order.id,
        provider: "asaas",
        paymentId: payment.id,
        status: payment.status,
        raw: payment,
      };
    } catch (error) {
      app.log.error({ err: error, orderId: body.orderId }, "Falha ao criar PIX Asaas");

      return reply.status(502).send({
        error: error instanceof Error ? error.message : "Erro ao criar pagamento Asaas",
      });
    }
  });

  app.post("/payments/mock/confirm", async (req, reply) => {
    const body = req.body as {
      orderId?: string;
    };

    if (!body?.orderId) {
      return reply.status(400).send({
        error: "orderId e obrigatorio",
      });
    }

    const orderResult = await app.pg.query<{
      id: string;
      tenant_id: string;
      status: string;
    }>(
      `
      SELECT *
      FROM orders
      WHERE id = $1
      LIMIT 1
      `,
      [body.orderId],
    );

    const order = orderResult.rows[0];

    if (!order) {
      return reply.status(404).send({
        error: "Pedido nao encontrado",
      });
    }

    if (order.status === "paid") {
      return reply.send({
        ok: true,
        alreadyPaid: true,
        orderId: order.id,
      });
    }

    if (order.status !== "reserved" && order.status !== "pending_payment") {
      return reply.status(400).send({
        error: "Pedido nao pode ser pago no status atual",
        status: order.status,
      });
    }

    const paymentId = crypto.randomUUID();

    await app.pg.query(
      `
      INSERT INTO payments (
        id,
        tenant_id,
        order_id,
        provider,
        provider_id,
        status,
        payload
      )
      VALUES ($1, $2, $3, 'mock', $4, 'confirmed', $5)
      `,
      [
        paymentId,
        order.tenant_id,
        order.id,
        `mock_${paymentId}`,
        JSON.stringify({
          confirmedAt: new Date().toISOString(),
          source: "local-mock",
        }),
      ],
    );

    await app.pg.query(
      `
      UPDATE orders
      SET status = 'paid',
          updated_at = NOW()
      WHERE id = $1
      `,
      [order.id],
    );

    await generateTicketsForOrder(app, order.id);

    return {
      ok: true,
      orderId: order.id,
      paymentId,
      status: "paid",
    };
  });
}
