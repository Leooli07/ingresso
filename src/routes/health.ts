import type { FastifyInstance } from "fastify";

export const registerHealthRoutes = async (app: FastifyInstance) => {
  app.get("/", async () => ({
    name: "Ingressofacil API",
    status: "ok",
  }));

  app.get("/health", async () => ({
    status: "ok",
    environment: app.config.NODE_ENV,
    timestamp: new Date().toISOString(),
  }));
};
