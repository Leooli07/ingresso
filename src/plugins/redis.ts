import fp from "fastify-plugin";
import net from "node:net";
import Redis from "ioredis";

type AppRedis = {
  connect: () => Promise<unknown>;
  disconnect: () => void;
  ping: () => Promise<string>;
  get: (key: string) => Promise<string | null>;
  set: (
    key: string,
    value: string,
    mode?: "NX" | "XX",
    ttlMode?: "EX",
    ttlSeconds?: number,
  ) => Promise<unknown>;
  incrby: (key: string, increment: number) => Promise<number>;
  decrby: (key: string, decrement: number) => Promise<number>;
  eval: (
    script: string,
    numKeys: number,
    key: string,
    arg: string | number,
  ) => Promise<number>;
  status: string;
};

export default fp(async (app) => {
  const store = new Map<string, string>();
  const memoryRedis: AppRedis = {
    status: "ready",
    async connect() {
      return "OK";
    },
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, mode) {
      if (mode === "NX" && store.has(key)) {
        return null;
      }

      store.set(key, value);
      return "OK";
    },
    async incrby(key, increment) {
      const current = Number(store.get(key) ?? "0");
      const next = current + increment;
      store.set(key, String(next));
      return next;
    },
    async decrby(key, decrement) {
      const current = Number(store.get(key) ?? "0");
      const next = current - decrement;
      store.set(key, String(next));
      return next;
    },
    async eval(_script, _numKeys, key, arg) {
      const current = Number(store.get(key) ?? "0");
      const qty = Number(arg);

      if (current < qty) {
        return -1;
      }

      const next = current - qty;
      store.set(key, String(next));
      return next;
    },
    disconnect() {},
    async ping() {
      return "PONG";
    },
  };

  try {
    const url = new URL(app.config.REDIS_URL || "redis://localhost:6379");
    await new Promise<void>((resolve, reject) => {
      const socket = net.createConnection({
        host: url.hostname,
        port: Number(url.port || 6379),
      });

      socket.once("connect", () => {
        socket.end();
        resolve();
      });

      socket.once("error", reject);
      socket.setTimeout(500, () => {
        socket.destroy();
        reject(new Error("Redis timeout"));
      });
    });

    const redis = new Redis(app.config.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    await redis.connect();
    app.decorate("redis", redis as AppRedis);
  } catch (error) {
    app.log.warn({ err: error }, "Redis indisponivel; usando fallback local em memoria");
    app.decorate("redis", memoryRedis);
  }

  app.addHook("onClose", async () => {
    app.redis.disconnect();
  });
});
