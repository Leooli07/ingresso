import fp from "fastify-plugin";
import pg from "pg";

export default fp(async (app) => {
  const pool = new pg.Pool({
    connectionString: app.config.DATABASE_URL,
  });

  app.decorate("pg", pool);

  app.addHook("onClose", async () => {
    await pool.end();
  });
});
