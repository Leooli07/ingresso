import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export const registerCors = async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
};
