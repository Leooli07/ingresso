import { buildApp } from "./app.js";

const start = async () => {
  const app = buildApp();

  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.config.PORT,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
