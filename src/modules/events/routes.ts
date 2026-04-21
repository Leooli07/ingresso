import type { FastifyInstance } from "fastify";

const events = [
  {
    id: "evt-1",
    title: "Festival Ingressofacil",
    city: "Sao Paulo",
    category: "festival",
    published: true,
  },
  {
    id: "evt-2",
    title: "Noite da Comedia",
    city: "Rio de Janeiro",
    category: "show",
    published: false,
  },
];

export const registerEventRoutes = async (app: FastifyInstance) => {
  app.get("/", async (request) => {
    const query = request.query as { published?: string };
    const filtered =
      query.published === undefined
        ? events
        : events.filter((item) => String(item.published) === query.published);

    return {
      items: filtered,
      total: filtered.length,
    };
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = events.find((item) => item.id === id);

    if (!event) {
      return reply.status(404).send({
        message: "Evento nao encontrado.",
      });
    }

    return event;
  });
};
