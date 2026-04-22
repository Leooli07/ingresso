import type { FastifyInstance } from "fastify";
import {
  createUser,
  findUserByEmail,
  getUserById,
  verifyPassword,
} from "./service.js";

export const registerAuthRoutes = async (app: FastifyInstance) => {
  // POST /auth/register — create a new user account
  app.post("/register", async (request, reply) => {
    const body = request.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    };

    if (!body?.email || !body?.password || !body?.name) {
      return reply.status(400).send({
        message: "Email, password e name sao obrigatorios.",
      });
    }

    const existing = await findUserByEmail(app.pg, body.email);
    if (existing) {
      return reply.status(409).send({
        message: "Email ja cadastrado.",
      });
    }

    const user = await createUser(
      app.pg,
      body.email,
      body.password,
      body.name,
      body.role ?? "user",
    );

    const token = await app.jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return reply.status(201).send({
      token,
      user,
    });
  });

  // POST /auth/login — validate credentials and return a JWT token
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

    const user = await findUserByEmail(app.pg, body.email);
    if (!user) {
      return reply.status(401).send({
        message: "Credenciais invalidas.",
      });
    }

    const passwordValid = await verifyPassword(body.password, user.password_hash);
    if (!passwordValid) {
      return reply.status(401).send({
        message: "Credenciais invalidas.",
      });
    }

    const token = await app.jwt.sign({
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
        tenant_id: user.tenant_id,
      },
    };
  });

  // GET /auth/me — return the authenticated user from the JWT payload
  app.get(
    "/me",
    {
      preHandler: app.authenticate,
    },
    async (request) => {
      const user = await getUserById(app.pg, request.user.sub);
      if (!user) {
        return { user: request.user };
      }
      return { user };
    },
  );
};
