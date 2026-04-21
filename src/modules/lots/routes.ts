import type { FastifyInstance } from "fastify";

const lots = [
  {
    id: "lot-1",
    sessionId: "ses-1",
    name: "Primeiro lote",
    price: 80,
    quantity: 150,
  },
  {
    id: "lot-2",
    sessionId: "ses-1",
    name: "Segundo lote",
    price: 110,
    quantity: 200,
  },
  {
    id: "lot-3",
    sessionId: "ses-2",
    name: "Lote promocional",
    price: 70,
    quantity: 80,
  },
];

export const registerLotRoutes = async (app: FastifyInstance) => {
  app.get("/", async (request) => {
    const query = request.query as { sessionId?: string };
    const filtered = query.sessionId
      ? lots.filter((item) => item.sessionId === query.sessionId)
      : lots;

    return {
      items: filtered,
      total: filtered.length,
    };
  });

  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const lot = lots.find((item) => item.id === id);

    if (!lot) {
      return reply.status(404).send({
        message: "Lote nao encontrado.",
      });
    }

    return lot;
  });
};
