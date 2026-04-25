import { buildApp } from "./app.js";
import { expireOrders } from "./workers/expire-orders.js";
import { reconcileStock } from "./workers/reconcile-stock.js";

const start = async () => {
  const app = buildApp();

  try {
    setInterval(() => {
      void expireOrders(app).catch(app.log.error);
    }, 60_000);

    setInterval(() => {
      void reconcileStock(app).catch(app.log.error);
    }, 300_000);

    await app.listen({
      host: "0.0.0.0",
      port: Number(process.env.PORT || 3000),
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
