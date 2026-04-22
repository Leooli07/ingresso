import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => ({
    name: "Ingressofacil API",
    status: "ok",
  }));

  app.get("/health", async () => {
    let dbStatus = "down";
    let redisStatus = "down";

    try {
      await app.pg.query("SELECT 1");
      dbStatus = "up";
    } catch {}

    try {
      if (app.redis.status !== "ready") {
        await app.redis.connect();
      }

      const pong = await app.redis.ping();
      if (pong === "PONG") {
        redisStatus = "up";
      }
    } catch {}

    return {
      status: "ok",
      environment: app.config.NODE_ENV,
      timestamp: new Date().toISOString(),
      services: {
        api: "up",
        db: dbStatus,
        redis: redisStatus,
      },
    };
  });
}
