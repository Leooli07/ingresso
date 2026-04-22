import "fastify";
import type { Pool } from "pg";
import type Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    pg: Pool;
    redis: Redis;
    authenticate: (req: any, reply: any) => Promise<void>;
  }

  interface FastifyRequest {
    user: {
      userId: string;
      tenantId: string;
      email: string;
    };
  }
}
