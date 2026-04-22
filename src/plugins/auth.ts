import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

export default fp(async (app: FastifyInstance) => {
  app.decorate("authenticate", async function (req: any, reply: any) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
});
