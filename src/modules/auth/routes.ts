import type { FastifyInstance } from "fastify";
import { verifyPassword } from "../../utils/password.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    const body = req.body as { email?: string; password?: string };

    if (!body?.email || !body?.password) {
      return reply.status(400).send({
        error: "Email e senha são obrigatórios",
      });
    }

    const result = await app.pg.query(
      `
      SELECT
        id,
        tenant_id,
        name,
        email,
        password_hash
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [body.email]
    );

    const user = result.rows[0];
    if (!user) {
      return reply.status(401).send({
        error: "Credenciais inválidas",
      });
    }

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({
        error: "Credenciais inválidas",
      });
    }

    const token = app.jwt.sign({
      userId: user.id,
      tenantId: user.tenant_id,
      email: user.email,
    });

    return {
      token,
      user: {
        id: user.id,
        tenantId: user.tenant_id,
        name: user.name,
        email: user.email,
      },
    };
  });

  app.get(
    "/auth/me",
    {
      preHandler: [app.authenticate],
    },
    async (req) => {
      return {
        user: req.user,
      };
    }
  );
}
