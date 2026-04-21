import type { FastifyInstance } from "fastify";

const sessions = [
  {
    id: "ses-1",
    eventId: "evt-1",
    startsAt: "2026-05-15T20:00:00.000Z",
    venue: "Arena Central",
    status: "scheduled",
  },
  {
    id: "ses-2",
    eventId: "evt-1",
    startsAt: "2026-05-16T20:00:00.000Z",
    venue: "Arena Central",
    status: "scheduled",
  },
  {
    id: "ses-3",
    eventId: "evt-2",
    startsAt: "2026-06-01T21:00:00.000Z",
    venue: "Teatro Sul",
    status: "draft",
  },
];

export const registerSessionRoutes = async (app: FastifyInstance) => {
  app.get("/", async (request) => {
    const query = request.query as { eventId?: string };
    const filtered = query.eventId
      ? sessions.filter((item) => item.eventId === query.eventId)
      : sessions;

    return {
      items: filtered,
      total: filtered.length,
    };
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = sessions.find((item) => item.id === id);

    if (!session) {
      return reply.status(404).send({
        message: "Sessao nao encontrada.",
      });
    }

    return session;
  });
};
