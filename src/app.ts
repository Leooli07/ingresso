import Fastify from "fastify";

import { env } from "./config/env.js";
import { registerCors } from "./plugins/cors.js";
import { registerJwt } from "./plugins/jwt.js";
import authPlugin from "./plugins/auth.js";
import postgresPlugin from "./plugins/postgres.js";
import redisPlugin from "./plugins/redis.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./modules/auth/routes.js";
import { registerEventRoutes } from "./modules/events/routes.js";
import { registerSessionRoutes } from "./modules/sessions/routes.js";
import { registerLotRoutes } from "./modules/lots/routes.js";
import { checkoutRoutes } from "./modules/checkout/routes.js";
import { paymentsRoutes } from "./modules/payments/routes.js";
import { asaasWebhookRoutes } from "./modules/payments/asaas-webhook.js";
import { registerOrderRoutes } from "./modules/orders/routes.js";
import { registerTicketRoutes } from "./modules/tickets/routes.js";
import { registerCheckinRoutes } from "./modules/checkin/routes.js";
import { registerDashboardRoutes } from "./modules/dashboard/routes.js";
import { adminRoutes } from "./modules/admin/routes.js";

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
  void app.register(authRoutes);
  void app.register(registerEventRoutes, { prefix: "/events" });
  void app.register(registerSessionRoutes);
  void app.register(registerLotRoutes);
  void app.register(checkoutRoutes);
  void app.register(paymentsRoutes);
  void app.register(asaasWebhookRoutes);
  void app.register(registerOrderRoutes, { prefix: "/orders" });
  void app.register(registerTicketRoutes);
  void app.register(registerCheckinRoutes, { prefix: "/checkin" });
  void app.register(registerDashboardRoutes);
  void app.register(adminRoutes);

  return app;
};

declare module "fastify" {
  interface FastifyInstance {
    config: typeof env;
  }
}
