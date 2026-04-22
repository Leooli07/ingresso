import Fastify from "fastify";

import { env } from "./config/env.js";
import { registerCors } from "./plugins/cors.js";
import { registerJwt } from "./plugins/jwt.js";
import postgresPlugin from "./plugins/postgres.js";
import redisPlugin from "./plugins/redis.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./modules/auth/routes.js";
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
  void app.register(authPlugin);

  void app.register(healthRoutes);
  void authRoutes(app);
  void app.register(registerEventRoutes, { prefix: "/events" });
  void app.register(registerSessionRoutes, { prefix: "/sessions" });
  void app.register(registerLotRoutes, { prefix: "/lots" });

  return app;
};

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
  }
}
