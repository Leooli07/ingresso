import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

type SessionRow = {
  id: string;
  tenant_id: string;
  event_id: string;
  starts_at: Date;
  ends_at: Date | null;
  timezone: string;
  capacity: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  event_title?: string;
};

async function ensureEventBelongsToTenant(
  app: FastifyInstance,
  eventId: string,
  tenantId: string,
) {
  const result = await app.pg.query<{ id: string }>(
    `
    SELECT id
    FROM events
    WHERE id = $1
      AND tenant_id = $2
    LIMIT 1
    `,
    [eventId, tenantId],
  );

  return result.rows[0] ?? null;
}

function mapSession(session: SessionRow) {
  return {
    id: session.id,
    tenant_id: session.tenant_id,
    event_id: session.event_id,
    starts_at: session.starts_at.toISOString(),
    ends_at: session.ends_at?.toISOString() ?? null,
    timezone: session.timezone,
    capacity: session.capacity,
    status: session.status,
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString(),
    ...(session.event_title ? { event_title: session.event_title } : {}),
  };
}

export const registerSessionRoutes = async (app: FastifyInstance) => {
  app.get(
    "/sessions",
    {
      preHandler: [app.authenticate],
    },
    async (req) => {
      const result = await app.pg.query<SessionRow>(
        `
        SELECT
          s.id,
          s.tenant_id,
          s.event_id,
          s.starts_at,
          s.ends_at,
          s.timezone,
          s.capacity,
          s.status,
          s.created_at,
          s.updated_at,
          e.title AS event_title
        FROM sessions s
        JOIN events e ON e.id = s.event_id
        WHERE s.tenant_id = $1
        ORDER BY s.starts_at ASC
        `,
        [req.user.tenantId],
      );

      return {
        items: result.rows.map(mapSession),
      };
    },
  );

  app.get(
    "/events/:eventId/sessions",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const params = req.params as { eventId: string };

      const event = await ensureEventBelongsToTenant(
        app,
        params.eventId,
        req.user.tenantId,
      );

      if (!event) {
        return reply.status(404).send({
          error: "Evento nao encontrado",
        });
      }

      const result = await app.pg.query<SessionRow>(
        `
        SELECT
          id,
          tenant_id,
          event_id,
          starts_at,
          ends_at,
          timezone,
          capacity,
          status,
          created_at,
          updated_at
        FROM sessions
        WHERE event_id = $1
          AND tenant_id = $2
        ORDER BY starts_at ASC
        `,
        [params.eventId, req.user.tenantId],
      );

      return {
        items: result.rows.map(mapSession),
      };
    },
  );

  app.get(
    "/sessions/:id",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const params = req.params as { id: string };

      const result = await app.pg.query<SessionRow>(
        `
        SELECT
          s.id,
          s.tenant_id,
          s.event_id,
          s.starts_at,
          s.ends_at,
          s.timezone,
          s.capacity,
          s.status,
          s.created_at,
          s.updated_at,
          e.title AS event_title
        FROM sessions s
        JOIN events e ON e.id = s.event_id
        WHERE s.id = $1
          AND s.tenant_id = $2
        LIMIT 1
        `,
        [params.id, req.user.tenantId],
      );

      const session = result.rows[0];

      if (!session) {
        return reply.status(404).send({
          error: "Sessao nao encontrada",
        });
      }

      return mapSession(session);
    },
  );

  app.post(
    "/sessions",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const body = req.body as {
        eventId?: string;
        startsAt?: string;
        endsAt?: string;
        timezone?: string;
        capacity?: number;
        status?: string;
      };

      if (!body?.eventId || !body?.startsAt || !body?.capacity) {
        return reply.status(400).send({
          error: "eventId, startsAt e capacity sao obrigatorios",
        });
      }

      const event = await ensureEventBelongsToTenant(
        app,
        body.eventId,
        req.user.tenantId,
      );

      if (!event) {
        return reply.status(404).send({
          error: "Evento nao encontrado para este tenant",
        });
      }

      const id = crypto.randomUUID();

      await app.pg.query(
        `
        INSERT INTO sessions (
          id,
          tenant_id,
          event_id,
          starts_at,
          ends_at,
          timezone,
          capacity,
          status,
          venue_name,
          room_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          id,
          req.user.tenantId,
          body.eventId,
          body.startsAt,
          body.endsAt ?? null,
          body.timezone ?? "America/Sao_Paulo",
          body.capacity,
          body.status ?? "draft",
          body.timezone ?? "America/Sao_Paulo",
          null,
        ],
      );

      const result = await app.pg.query<SessionRow>(
        `
        SELECT
          id,
          tenant_id,
          event_id,
          starts_at,
          ends_at,
          timezone,
          capacity,
          status,
          created_at,
          updated_at
        FROM sessions
        WHERE id = $1
        LIMIT 1
        `,
        [id],
      );

      return reply.status(201).send(mapSession(result.rows[0]));
    },
  );
};
