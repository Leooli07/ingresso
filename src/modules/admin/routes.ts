import type { FastifyInstance } from "fastify";

import { expireOrders } from "../../workers/expire-orders.js";
import { reconcileStock } from "../../workers/reconcile-stock.js";

export async function adminRoutes(app: FastifyInstance) {
  app.post(
    "/admin/jobs/expire-orders",
    {
      preHandler: [app.authenticate],
    },
    async () => expireOrders(app),
  );

  app.post(
    "/admin/jobs/reconcile-stock",
    {
      preHandler: [app.authenticate],
    },
    async () => reconcileStock(app),
  );
}
