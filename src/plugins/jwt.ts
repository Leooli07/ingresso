import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

const jwtPlugin = async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
  });

  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch (error) {
        reply.send(error);
      }
    },
  );
};

export const registerJwt = fp(jwtPlugin);

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      email: string;
      role: string;
      name: string;
    };
    user: {
      sub: string;
      email: string;
      role: string;
      name: string;
    };
  }
}
