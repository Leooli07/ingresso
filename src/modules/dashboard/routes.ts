import type { FastifyInstance } from "fastify";

type JwtUser = {
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
};

function toIso(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value ?? null;
}

export const registerDashboardRoutes = async (app: FastifyInstance) => {
  app.get(
    "/dashboard",
    {
      preHandler: [app.authenticate],
    },
    async (req) => {
      const user = req.user as JwtUser;

      const [
        ordersResult,
        revenueResult,
        ticketsResult,
        checkinsResult,
        sessionsResult,
      ] = await Promise.all([
        app.pg.query(
          `
          SELECT COUNT(*)::int AS total
          FROM orders
          WHERE tenant_id = $1
            AND status = 'paid'
          `,
          [user.tenantId],
        ),

        app.pg.query(
          `
          SELECT COALESCE(SUM(total), 0)::int AS total
          FROM orders
          WHERE tenant_id = $1
            AND status = 'paid'
          `,
          [user.tenantId],
        ),

        app.pg.query(
          `
          SELECT COUNT(*)::int AS total
          FROM tickets
          WHERE tenant_id = $1
          `,
          [user.tenantId],
        ),

        app.pg.query(
          `
          SELECT COUNT(*)::int AS total
          FROM tickets
          WHERE tenant_id = $1
            AND status = 'used'
          `,
          [user.tenantId],
        ),

        app.pg.query(
          `
          SELECT
            s.id,
            s.event_id,
            e.title AS event_title,
            s.starts_at,
            s.capacity,
            s.status,
            COUNT(t.id)::int AS issued_tickets,
            COUNT(CASE WHEN t.status = 'used' THEN 1 END)::int AS checked_in,
            CASE
              WHEN s.capacity > 0
                THEN ROUND((COUNT(CASE WHEN t.status = 'used' THEN 1 END)::numeric / s.capacity) * 100, 2)
              ELSE 0
            END AS occupancy_rate
          FROM sessions s
          JOIN events e ON e.id = s.event_id
          LEFT JOIN tickets t ON t.session_id = s.id
          WHERE s.tenant_id = $1
          GROUP BY s.id, s.event_id, e.title, s.starts_at, s.capacity, s.status
          ORDER BY s.starts_at ASC
          LIMIT 20
          `,
          [user.tenantId],
        ),
      ]);

      return {
        summary: {
          paidOrders: ordersResult.rows[0]?.total ?? 0,
          revenue: revenueResult.rows[0]?.total ?? 0,
          issuedTickets: ticketsResult.rows[0]?.total ?? 0,
          checkedInTickets: checkinsResult.rows[0]?.total ?? 0,
        },
        sessions: sessionsResult.rows.map((session) => ({
          ...session,
          starts_at: toIso(session.starts_at),
        })),
      };
    },
  );

  app.get(
    "/dashboard/sessions/:id",
    {
      preHandler: [app.authenticate],
    },
    async (req, reply) => {
      const user = req.user as JwtUser;
      const params = req.params as { id: string };

      const sessionResult = await app.pg.query(
        `
        SELECT
          s.id,
          s.event_id,
          e.title AS event_title,
          s.starts_at,
          s.ends_at,
          s.capacity,
          s.status,
          COUNT(t.id)::int AS issued_tickets,
          COUNT(CASE WHEN t.status = 'used' THEN 1 END)::int AS checked_in,
          COUNT(CASE WHEN t.status = 'valid' THEN 1 END)::int AS pending_checkin,
          CASE
            WHEN s.capacity > 0
              THEN ROUND((COUNT(CASE WHEN t.status = 'used' THEN 1 END)::numeric / s.capacity) * 100, 2)
            ELSE 0
          END AS occupancy_rate
        FROM sessions s
        JOIN events e ON e.id = s.event_id
        LEFT JOIN tickets t ON t.session_id = s.id
        WHERE s.id = $1
          AND s.tenant_id = $2
        GROUP BY s.id, s.event_id, e.title, s.starts_at, s.ends_at, s.capacity, s.status
        LIMIT 1
        `,
        [params.id, user.tenantId],
      );

      const session = sessionResult.rows[0];

      if (!session) {
        return reply.status(404).send({
          error: "Sessao nao encontrada",
        });
      }

      const lotsResult = await app.pg.query(
        `
        SELECT
          l.id,
          l.name,
          l.price,
          l.stock,
          l.sold,
          l.status,
          COUNT(t.id)::int AS issued_tickets,
          COUNT(CASE WHEN t.status = 'used' THEN 1 END)::int AS checked_in
        FROM lots l
        LEFT JOIN tickets t ON t.lot_id = l.id
        WHERE l.session_id = $1
          AND l.tenant_id = $2
        GROUP BY l.id, l.name, l.price, l.stock, l.sold, l.status, l.created_at
        ORDER BY l.created_at ASC
        `,
        [params.id, user.tenantId],
      );

      return {
        session: {
          ...session,
          starts_at: toIso(session.starts_at),
          ends_at: toIso(session.ends_at),
        },
        lots: lotsResult.rows,
      };
    },
  );
};
