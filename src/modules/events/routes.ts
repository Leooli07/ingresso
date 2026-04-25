import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

type EventRow = {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: Date;
  ends_at: Date | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

function mapEvent(event: EventRow) {
  return {
    id: event.id,
    tenant_id: event.tenant_id,
    title: event.title,
    description: event.description,
    location: event.location,
    starts_at: event.starts_at.toISOString(),
    ends_at: event.ends_at?.toISOString() ?? null,
    status: event.status,
    created_at: event.created_at.toISOString(),
    updated_at: event.updated_at.toISOString(),
  };
}

export const registerEventRoutes = async (app: FastifyInstance) => {
  app.get(
    "/",
    {
      preHandler: [app.authenticate],
    },
    async (req) => {
      const result = await app.pg.query<EventRow>(
        `
        SELECT
          id,
          tenant_id,
          title,
          description,
          location,
          starts_at,
          ends_at,
          status,
          created_at,
          updated_at
        FROM events
        WHERE tenant_id = $1
        ORDER BY starts_at ASC
        `,
        [req.user.tenantId],
      );

      return {
        items: result.rows.map(mapEvent),
      };
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const params = req.params as { id: string };

      const result = await app.pg.query<EventRow>(
        `
        SELECT
          id,
          tenant_id,
          title,
          description,
          location,
          starts_at,
          ends_at,
          status,
          created_at,
          updated_at
        FROM events
        WHERE id = $1
          AND tenant_id = $2
        LIMIT 1
        `,
        [params.id, req.user.tenantId],
      );

      const event = result.rows[0];

      if (!event) {
        return reply.status(404).send({
          error: "Evento nao encontrado",
        });
      }

      return mapEvent(event);
    },
  );

  app.post(
    "/",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const body = req.body as {
        title?: string;
        description?: string;
        location?: string;
        startsAt?: string;
        endsAt?: string;
        status?: string;
      };

      if (!body?.title || !body?.startsAt) {
        return reply.status(400).send({
          error: "title e startsAt sao obrigatorios",
        });
      }

      const id = crypto.randomUUID();

      await app.pg.query(
        `
        INSERT INTO events (
          id,
          tenant_id,
          title,
          slug,
          description,
          category,
          city,
          venue_name,
          published,
          location,
          starts_at,
          ends_at,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `,
        [
          id,
          req.user.tenantId,
          body.title,
          `${slugify(body.title)}-${id.slice(0, 8)}`,
          body.description ?? null,
          "general",
          body.location ?? "Sem cidade",
          body.location ?? null,
          body.status === "published",
          body.location ?? null,
          body.startsAt,
          body.endsAt ?? null,
          body.status ?? "draft",
        ],
      );

      const result = await app.pg.query<EventRow>(
        `
        SELECT
          id,
          tenant_id,
          title,
          description,
          location,
          starts_at,
          ends_at,
          status,
          created_at,
          updated_at
        FROM events
        WHERE id = $1
        LIMIT 1
        `,
        [id],
      );

      return reply.status(201).send(mapEvent(result.rows[0]));
    },
  );
};
