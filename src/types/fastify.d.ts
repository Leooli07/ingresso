import "fastify";
import type { Pool } from "pg";
import type Redis from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    pg: Pool;
    redis: Redis;
  }
}
