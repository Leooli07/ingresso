import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

type LotRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sold: number;
  max_per_customer: number | null;
  sales_start_at: Date | null;
  sales_end_at: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  session_starts_at?: Date;
  event_title?: string;
};

async function ensureSessionBelongsToTenant(
  app: FastifyInstance,
  sessionId: string,
  tenantId: string,
) {
  const result = await app.pg.query<{ id: string; event_id: string }>(
    `
    SELECT id, event_id
    FROM sessions
    WHERE id = $1
      AND tenant_id = $2
    LIMIT 1
    `,
    [sessionId, tenantId],
  );

  return result.rows[0] ?? null;
}

function mapLot(lot: LotRow) {
  return {
    id: lot.id,
    tenant_id: lot.tenant_id,
    session_id: lot.session_id,
    name: lot.name,
    description: lot.description,
    price: lot.price,
    stock: lot.stock,
    sold: lot.sold,
    max_per_customer: lot.max_per_customer,
    sales_start_at: lot.sales_start_at?.toISOString() ?? null,
    sales_end_at: lot.sales_end_at?.toISOString() ?? null,
    status: lot.status,
    created_at: lot.created_at.toISOString(),
    updated_at: lot.updated_at.toISOString(),
    ...(lot.session_starts_at
      ? { session_starts_at: lot.session_starts_at.toISOString() }
      : {}),
    ...(lot.event_title ? { event_title: lot.event_title } : {}),
  };
}

export const registerLotRoutes = async (app: FastifyInstance) => {
  app.get(
    "/lots",
    {
      preHandler: [app.authenticate],
    },
    async (req) => {
      const result = await app.pg.query<LotRow>(
        `
        SELECT
          l.id,
          l.tenant_id,
          l.session_id,
          l.name,
          l.description,
          l.price,
          l.stock,
          l.sold,
          l.max_per_customer,
          l.sales_start_at,
          l.sales_end_at,
          l.status,
          l.created_at,
          l.updated_at,
          s.starts_at AS session_starts_at,
          e.title AS event_title
        FROM lots l
        JOIN sessions s ON s.id = l.session_id
        JOIN events e ON e.id = s.event_id
        WHERE l.tenant_id = $1
        ORDER BY l.created_at DESC
        `,
        [req.user.tenantId],
      );

      return {
        items: result.rows.map(mapLot),
      };
    },
  );

  app.get(
    "/sessions/:sessionId/lots",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const params = req.params as { sessionId: string };

      const session = await ensureSessionBelongsToTenant(
        app,
        params.sessionId,
        req.user.tenantId,
      );

      if (!session) {
        return reply.status(404).send({
          error: "Sessao nao encontrada",
        });
      }

      const result = await app.pg.query<LotRow>(
        `
        SELECT
          id,
          tenant_id,
          session_id,
          name,
          description,
          price,
          stock,
          sold,
          max_per_customer,
          sales_start_at,
          sales_end_at,
          status,
          created_at,
          updated_at
        FROM lots
        WHERE session_id = $1
          AND tenant_id = $2
        ORDER BY created_at ASC
        `,
        [params.sessionId, req.user.tenantId],
      );

      return {
        items: result.rows.map(mapLot),
      };
    },
  );

  app.get(
    "/lots/:id",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const params = req.params as { id: string };

      const result = await app.pg.query<LotRow>(
        `
        SELECT
          l.id,
          l.tenant_id,
          l.session_id,
          l.name,
          l.description,
          l.price,
          l.stock,
          l.sold,
          l.max_per_customer,
          l.sales_start_at,
          l.sales_end_at,
          l.status,
          l.created_at,
          l.updated_at,
          s.starts_at AS session_starts_at,
          e.title AS event_title
        FROM lots l
        JOIN sessions s ON s.id = l.session_id
        JOIN events e ON e.id = s.event_id
        WHERE l.id = $1
          AND l.tenant_id = $2
        LIMIT 1
        `,
        [params.id, req.user.tenantId],
      );

      const lot = result.rows[0];

      if (!lot) {
        return reply.status(404).send({
          error: "Lote nao encontrado",
        });
      }

      return mapLot(lot);
    },
  );

  app.post(
    "/lots",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const body = req.body as {
        sessionId?: string;
        name?: string;
        description?: string;
        price?: number;
        stock?: number;
        maxPerCustomer?: number;
        salesStartAt?: string;
        salesEndAt?: string;
        status?: string;
      };

      if (!body?.sessionId || !body?.name || body.price === undefined || body.stock === undefined) {
        return reply.status(400).send({
          error: "sessionId, name, price e stock sao obrigatorios",
        });
      }

      if (body.price < 0 || body.stock < 0) {
        return reply.status(400).send({
          error: "price e stock nao podem ser negativos",
        });
      }

      const session = await ensureSessionBelongsToTenant(
        app,
        body.sessionId,
        req.user.tenantId,
      );

      if (!session) {
        return reply.status(404).send({
          error: "Sessao nao encontrada para este tenant",
        });
      }

      const id = crypto.randomUUID();

      await app.pg.query(
        `
        INSERT INTO lots (
          id,
          tenant_id,
          session_id,
          name,
          description,
          price,
          stock,
          sold,
          max_per_customer,
          sales_start_at,
          sales_end_at,
          status,
          event_id,
          price_cents,
          quantity_total,
          quantity_available,
          sales_starts_at,
          sales_ends_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `,
        [
          id,
          req.user.tenantId,
          body.sessionId,
          body.name,
          body.description ?? null,
          body.price,
          body.stock,
          body.maxPerCustomer ?? null,
          body.salesStartAt ?? null,
          body.salesEndAt ?? null,
          body.status ?? "draft",
          session.event_id,
          body.price,
          body.stock,
          body.stock,
          body.salesStartAt ?? null,
          body.salesEndAt ?? null,
        ],
      );

      await app.redis.set(`lot:${id}:stock`, String(body.stock));

      const result = await app.pg.query<LotRow>(
        `
        SELECT
          id,
          tenant_id,
          session_id,
          name,
          description,
          price,
          stock,
          sold,
          max_per_customer,
          sales_start_at,
          sales_end_at,
          status,
          created_at,
          updated_at
        FROM lots
        WHERE id = $1
        LIMIT 1
        `,
        [id],
      );

      return reply.status(201).send(mapLot(result.rows[0]));
    },
  );
};
