import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type Redis from "ioredis";

import { env } from "./config/env.js";
import { registerCors } from "./plugins/cors.js";
import { registerJwt } from "./plugins/jwt.js";
import postgresPlugin from "./plugins/postgres.js";
import redisPlugin from "./plugins/redis.js";
import { healthRoutes } from "./routes/health.js";
import { registerAuthRoutes } from "./modules/auth/routes.js";
import { registerEventRoutes } from "./modules/events/routes.js";
import { registerSessionRoutes } from "./modules/sessions/routes.js";
import { registerLotRoutes } from "./modules/lots/routes.js";

export const buildApp = () => {
  const app = Fastify({
    logger: env.NODE_ENV !== "test",
  });

  app.decorate("config", env);

  void app.register(registerCors);
  void app.register(registerJwt);
  void app.register(postgresPlugin);
  void app.register(redisPlugin);

  app.get("/", async () => {
    return {
      name: "Ingressofacil API",
      status: "ok",
    };
  });

  void app.register(healthRoutes);
  void app.register(registerAuthRoutes, { prefix: "/auth" });
  void app.register(registerEventRoutes, { prefix: "/events" });
  void app.register(registerSessionRoutes, { prefix: "/sessions" });
  void app.register(registerLotRoutes, { prefix: "/lots" });

  return app;
};

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    pg: Pool;
    redis: Redis;
  }
}
