import type { FastifyInstance } from "fastify";

const demoUsers = [
  {
    id: "user-1",
    email: "admin@ingressofacil.local",
    password: "123456",
    name: "Administrador",
    role: "admin",
  },
];

export const registerAuthRoutes = async (app: FastifyInstance) => {
  app.post("/login", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
    };

    if (!body?.email || !body?.password) {
      return reply.status(400).send({
        message: "Email e password sao obrigatorios.",
      });
    }

    const user = demoUsers.find(
      (item) => item.email === body.email && item.password === body.password,
    );

    if (!user) {
      return reply.status(401).send({
        message: "Credenciais invalidas.",
      });
    }

    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  });

  app.get(
    "/me",
    {
      preHandler: app.authenticate,
    },
    async (request) => ({
      user: request.user,
    }),
  );
};
