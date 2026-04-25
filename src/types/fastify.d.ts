import "fastify";

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

declare module "fastify" {
  interface FastifyInstance {
    pg: import("pg").Pool;
    redis: AppRedis;
    authenticate: (req: any, reply: any) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      userId: string;
      tenantId: string;
      email: string;
      name: string;
    };
  }
}
