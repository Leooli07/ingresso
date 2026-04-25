import fp from "fastify-plugin";

export default fp(async (app) => {
  app.decorate("authenticate", async function (req, reply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
});
