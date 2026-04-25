import type { FastifyInstance } from "fastify";

import { createQrCodeDataUrl } from "../../utils/qrcode.js";

type TicketRow = {
  id: string;
  tenant_id: string;
  order_id: string;
  customer_id?: string | null;
  lot_id: string | null;
  session_id: string | null;
  event_id?: string | null;
  attendee_name: string;
  attendee_email: string | null;
  code: string;
  qr_payload?: string;
  qr_code_payload: string;
  status: string;
  used_at?: Date | null;
  checked_in_at: Date | null;
  created_at: Date;
  updated_at: Date;
  event_title?: string;
  session_starts_at?: Date;
  lot_name?: string;
  customer_name?: string;
  customer_email?: string;
};

function mapTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    tenantId: ticket.tenant_id,
    orderId: ticket.order_id,
    lotId: ticket.lot_id,
    sessionId: ticket.session_id,
    attendeeName: ticket.attendee_name,
    attendeeEmail: ticket.attendee_email,
    code: ticket.code,
    qrPayload: ticket.qr_payload ?? ticket.qr_code_payload,
    qrCodePayload: ticket.qr_code_payload,
    status: ticket.status,
    usedAt: ticket.used_at?.toISOString() ?? null,
    checkedInAt: ticket.checked_in_at?.toISOString() ?? null,
    createdAt: ticket.created_at.toISOString(),
    updatedAt: ticket.updated_at.toISOString(),
  };
}

export const registerTicketRoutes = async (app: FastifyInstance) => {
  app.get("/tickets/by-order/:orderId", async (req, reply) => {
    const params = req.params as { orderId: string };
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
        c.email
      FROM orders o
      JOIN customers c ON c.id = o.customer_id
      WHERE o.id = $1
        AND c.email = $2
      LIMIT 1
      `,
      [params.orderId, query.email],
    );

    const order = orderResult.rows[0];

    if (!order) {
      return reply.status(404).send({
        error: "Pedido nao encontrado",
      });
    }

    const result = await app.pg.query<TicketRow>(
      `
      SELECT
        t.id,
        t.status,
        t.qr_payload,
        t.qr_code_payload,
        t.created_at,
        e.title AS event_title,
        s.starts_at AS session_starts_at,
        l.name AS lot_name
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      JOIN sessions s ON s.id = t.session_id
      JOIN lots l ON l.id = t.lot_id
      WHERE t.order_id = $1
      ORDER BY t.created_at ASC
      `,
      [params.orderId],
    );

    return {
      items: result.rows.map((ticket) => ({
        id: ticket.id,
        status: ticket.status,
        qr_payload: ticket.qr_payload ?? ticket.qr_code_payload,
        created_at: ticket.created_at.toISOString(),
        event_title: ticket.event_title,
        session_starts_at: ticket.session_starts_at?.toISOString() ?? null,
        lot_name: ticket.lot_name,
      })),
    };
  });

  app.get("/my-tickets", async (req, reply) => {
    const query = req.query as { email?: string };

    if (!query.email) {
      return reply.status(400).send({
        error: "email e obrigatorio",
      });
    }

    const result = await app.pg.query<TicketRow>(
      `
      SELECT
        t.id,
        t.status,
        t.qr_payload,
        t.created_at,
        t.used_at,
        o.id AS order_id,
        e.id AS event_id,
        e.title AS event_title,
        s.id AS session_id,
        s.starts_at AS session_starts_at,
        l.id AS lot_id,
        l.name AS lot_name,
        c.name AS customer_name,
        c.email AS customer_email
      FROM tickets t
      JOIN orders o ON o.id = t.order_id
      JOIN customers c ON c.id = t.customer_id
      JOIN events e ON e.id = t.event_id
      JOIN sessions s ON s.id = t.session_id
      JOIN lots l ON l.id = t.lot_id
      WHERE c.email = $1
      ORDER BY t.created_at DESC
      `,
      [query.email],
    );

    return {
      items: result.rows.map((ticket) => ({
        id: ticket.id,
        status: ticket.status,
        qr_payload: ticket.qr_payload,
        created_at: ticket.created_at.toISOString(),
        used_at: ticket.used_at?.toISOString() ?? null,
        order_id: ticket.order_id,
        event_id: ticket.event_id,
        event_title: ticket.event_title,
        session_id: ticket.session_id,
        session_starts_at: ticket.session_starts_at?.toISOString() ?? null,
        lot_id: ticket.lot_id,
        lot_name: ticket.lot_name,
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email,
      })),
    };
  });

  app.get(
    "/tickets",
    { preHandler: [app.authenticate] },
    async (request) => {
      const query = request.query as { orderId?: string; sessionId?: string };
      const values: string[] = [request.user.tenantId];
      const filters = ["tenant_id = $1"];

      if (query.orderId) {
        values.push(query.orderId);
        filters.push(`order_id = $${values.length}`);
      }

      if (query.sessionId) {
        values.push(query.sessionId);
        filters.push(`session_id = $${values.length}`);
      }

      const result = await app.pg.query<TicketRow>(
        `
        SELECT
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
          status,
          used_at,
          checked_in_at,
          created_at,
          updated_at
        FROM tickets
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at ASC
        `,
        values,
      );

      return {
        items: result.rows.map(mapTicket),
        total: result.rowCount,
      };
    },
  );

  app.get(
    "/tickets/:id",
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await app.pg.query<TicketRow>(
        `
        SELECT
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
          status,
          used_at,
          checked_in_at,
          created_at,
          updated_at
        FROM tickets
        WHERE id = $1 AND tenant_id = $2
        LIMIT 1
        `,
        [id, request.user.tenantId],
      );

      const ticket = result.rows[0];

      if (!ticket) {
        return reply.status(404).send({
          message: "Ingresso nao encontrado.",
        });
      }

      return {
        ...mapTicket(ticket),
        qrCode: createQrCodeDataUrl(ticket.qr_code_payload),
      };
    },
  );
};
