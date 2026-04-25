import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

const jwtPlugin = async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
  });
};

export const registerJwt = fp(jwtPlugin);

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: string;
      tenantId: string;
      email: string;
      name: string;
    };
    user: {
      userId: string;
      tenantId: string;
      email: string;
      name: string;
    };
  }
}
