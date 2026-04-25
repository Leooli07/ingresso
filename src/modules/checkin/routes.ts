import type { FastifyInstance } from "fastify";

import { verifyQrPayload } from "../../utils/qr.js";

type CheckinRow = {
  id: string;
  status: string;
  used_at: Date | null;
  event_title: string;
  session_starts_at: Date;
  lot_name: string;
};

export async function registerCheckinRoutes(app: FastifyInstance) {
  app.post("/", async (req, reply) => {
    const body = req.body as {
      qr?: string;
    };

    if (!body?.qr) {
      return reply.status(400).send({
        error: "qr e obrigatorio",
      });
    }

    const verified = verifyQrPayload(body.qr);

    if (!verified.valid) {
      return reply.status(400).send({
        error: "QR invalido",
      });
    }

    const data = verified.data as {
      ticketId?: string;
      orderId?: string;
      customerId?: string;
      lotId?: string;
      sessionId?: string;
      eventId?: string;
    };

    if (!data.ticketId) {
      return reply.status(400).send({
        error: "QR sem ticketId",
      });
    }

    const ticketResult = await app.pg.query<CheckinRow>(
      `
      SELECT
        t.id,
        t.status,
        t.used_at,
        e.title AS event_title,
        s.starts_at AS session_starts_at,
        l.name AS lot_name
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      JOIN sessions s ON s.id = t.session_id
      JOIN lots l ON l.id = t.lot_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [data.ticketId],
    );

    const ticket = ticketResult.rows[0];

    if (!ticket) {
      return reply.status(404).send({
        error: "Ingresso nao encontrado",
      });
    }

    if (ticket.status !== "valid") {
      return reply.status(409).send({
        error: "Ingresso ja utilizado ou invalido",
        status: ticket.status,
        usedAt: ticket.used_at?.toISOString() ?? null,
      });
    }

    await app.pg.query(
      `
      UPDATE tickets
      SET
        status = 'used',
        used_at = NOW(),
        checked_in_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      `,
      [ticket.id],
    );

    const updatedResult = await app.pg.query<CheckinRow>(
      `
      SELECT
        t.id,
        t.status,
        t.used_at,
        e.title AS event_title,
        s.starts_at AS session_starts_at,
        l.name AS lot_name
      FROM tickets t
      JOIN events e ON e.id = t.event_id
      JOIN sessions s ON s.id = t.session_id
      JOIN lots l ON l.id = t.lot_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [ticket.id],
    );

    const updated = updatedResult.rows[0];

    return {
      success: true,
      message: "Entrada liberada",
      ticket: {
        id: updated.id,
        status: updated.status,
        used_at: updated.used_at?.toISOString() ?? null,
        event_title: updated.event_title,
        session_starts_at: updated.session_starts_at.toISOString(),
        lot_name: updated.lot_name,
      },
    };
  });
}
