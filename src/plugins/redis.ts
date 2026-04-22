import fp from "fastify-plugin";
import Redis from "ioredis";

export default fp(async (app) => {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });

  app.decorate("redis", redis);

  app.addHook("onClose", async () => {
    redis.disconnect();
  });
});
