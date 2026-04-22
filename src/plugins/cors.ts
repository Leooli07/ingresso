import cors from "@fastify/cors";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

const corsPlugin = async (app: FastifyInstance) => {
  await app.register(cors, {
    origin: true,
    credentials: true,
  });
};

export const registerCors = fp(corsPlugin);
