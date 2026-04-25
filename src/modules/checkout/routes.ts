import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

import { findOrCreateCustomer } from "../customers/service.js";

type CheckoutLotRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  event_id: string;
  name: string;
  price: number;
  stock: number;
  sold: number;
  max_per_customer: number | null;
  sales_start_at: Date | null;
  sales_end_at: Date | null;
  lot_status: string;
  session_status: string;
  event_status: string;
};

async function getLotForCheckout(app: FastifyInstance, lotId: string) {
  const result = await app.pg.query<CheckoutLotRow>(
    `
    SELECT
      l.id,
      l.tenant_id,
      l.session_id,
      s.event_id,
      l.name,
      l.price,
      l.stock,
      l.sold,
      l.max_per_customer,
      l.sales_start_at,
      l.sales_end_at,
      l.status AS lot_status,
      s.status AS session_status,
      e.status AS event_status
    FROM lots l
    JOIN sessions s ON s.id = l.session_id
    JOIN events e ON e.id = s.event_id
    WHERE l.id = $1
    LIMIT 1
    `,
    [lotId],
  );

  return result.rows[0] ?? null;
}

function validateLotForCheckout(
  lot: CheckoutLotRow | null,
  quantity: number,
) {
  const now = new Date();

  if (!lot) {
    throw new Error("Lote nao encontrado");
  }

  if (lot.event_status !== "published") {
    throw new Error("Evento nao disponivel");
  }

  if (lot.session_status !== "published") {
    throw new Error("Sessao nao disponivel");
  }

  if (lot.lot_status !== "published") {
    throw new Error("Lote nao disponivel");
  }

  if (lot.sales_start_at && new Date(lot.sales_start_at) > now) {
    throw new Error("Venda ainda nao iniciada");
  }

  if (lot.sales_end_at && new Date(lot.sales_end_at) < now) {
    throw new Error("Venda encerrada");
  }

  if (lot.max_per_customer && quantity > Number(lot.max_per_customer)) {
    throw new Error("Quantidade excede o limite por cliente");
  }
}

async function reserveStock(
  app: FastifyInstance,
  lotId: string,
  quantity: number,
  availableStock: number,
) {
  const key = `lot:${lotId}:stock`;
  const current = await app.redis.get(key);

  if (current === null) {
    await app.redis.set(key, String(availableStock));
  }

  const result = await app.redis.eval(
    `
    local current = tonumber(redis.call('GET', KEYS[1]) or '0')
    local qty = tonumber(ARGV[1])

    if current < qty then
      return -1
    end

    return redis.call('DECRBY', KEYS[1], qty)
    `,
    1,
    key,
    quantity,
  );

  if (Number(result) < 0) {
    throw new Error("Estoque insuficiente");
  }
}

export async function checkoutRoutes(app: FastifyInstance) {
  app.post("/checkout/reserve", async (req, reply) => {
    const body = req.body as {
      customer?: {
        name?: string;
        email?: string;
        phone?: string;
      };
      items?: Array<{
        lotId?: string;
        quantity?: number;
      }>;
    };

    if (!body?.customer?.name) {
      return reply.status(400).send({
        error: "customer.name e obrigatorio",
      });
    }

    if (!body.items?.length) {
      return reply.status(400).send({
        error: "items e obrigatorio",
      });
    }

    const contexts: Array<{
      item: { lotId: string; quantity: number };
      lot: CheckoutLotRow;
    }> = [];

    for (const item of body.items) {
      if (!item.lotId || !item.quantity || item.quantity <= 0) {
        return reply.status(400).send({
          error: "lotId e quantity sao obrigatorios",
        });
      }

      const lot = await getLotForCheckout(app, item.lotId);
      validateLotForCheckout(lot, item.quantity);

      contexts.push({
        item: {
          lotId: item.lotId,
          quantity: item.quantity,
        },
        lot: lot!,
      });
    }

    const tenantIds = [...new Set(contexts.map((ctx) => ctx.lot.tenant_id))];

    if (tenantIds.length !== 1) {
      return reply.status(400).send({
        error: "Todos os itens devem pertencer ao mesmo tenant",
      });
    }

    const tenantId = tenantIds[0];

    const customer = await findOrCreateCustomer(app, {
      tenantId,
      name: body.customer.name,
      email: body.customer.email ?? null,
      phone: body.customer.phone ?? null,
    });

    const reservedItems: Array<{ lotId: string; quantity: number }> = [];

    try {
      let total = 0;

      for (const ctx of contexts) {
        await reserveStock(
          app,
          ctx.item.lotId,
          ctx.item.quantity,
          Number(ctx.lot.stock) - Number(ctx.lot.sold),
        );

        reservedItems.push({
          lotId: ctx.item.lotId,
          quantity: ctx.item.quantity,
        });

        total += Number(ctx.lot.price) * Number(ctx.item.quantity);
      }

      const orderId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await app.pg.query(
        `
        INSERT INTO orders (
          id,
          tenant_id,
          customer_id,
          event_id,
          session_id,
          customer_name,
          customer_email,
          total,
          total_cents,
          status,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, 'reserved', $9)
        `,
        [
          orderId,
          tenantId,
          customer.id,
          contexts[0].lot.event_id,
          contexts[0].lot.session_id,
          customer.name,
          customer.email ?? "checkout@local.invalid",
          total,
          expiresAt,
        ],
      );

      for (const ctx of contexts) {
        await app.pg.query(
          `
          INSERT INTO order_items (
            id,
            order_id,
            lot_id,
            quantity,
            price,
            unit_price_cents,
            total_price_cents
          )
          VALUES ($1, $2, $3, $4, $5, $5, $6)
          `,
          [
            crypto.randomUUID(),
            orderId,
            ctx.item.lotId,
            ctx.item.quantity,
            ctx.lot.price,
            ctx.lot.price * ctx.item.quantity,
          ],
        );
      }

      return reply.status(201).send({
        orderId,
        tenantId,
        total,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      for (const item of reservedItems) {
        await app.redis.incrby(`lot:${item.lotId}:stock`, item.quantity);
      }

      return reply.status(400).send({
        error: error instanceof Error ? error.message : "Erro ao reservar pedido",
      });
    }
  });
}
