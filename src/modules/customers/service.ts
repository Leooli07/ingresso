import crypto from "node:crypto";

import type { FastifyInstance } from "fastify";

type CustomerRow = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: Date;
};

export async function findOrCreateCustomer(
  app: FastifyInstance,
  input: {
    tenantId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  },
) {
  let existing: CustomerRow | null = null;

  if (input.email) {
    const byEmail = await app.pg.query<CustomerRow>(
      `
      SELECT *
      FROM customers
      WHERE tenant_id = $1
        AND email = $2
      LIMIT 1
      `,
      [input.tenantId, input.email],
    );

    existing = byEmail.rows[0] ?? null;
  }

  if (!existing && input.phone) {
    const byPhone = await app.pg.query<CustomerRow>(
      `
      SELECT *
      FROM customers
      WHERE tenant_id = $1
        AND phone = $2
      LIMIT 1
      `,
      [input.tenantId, input.phone],
    );

    existing = byPhone.rows[0] ?? null;
  }

  if (existing) {
    await app.pg.query(
      `
      UPDATE customers
      SET
        name = COALESCE($1, name),
        email = COALESCE($2, email),
        phone = COALESCE($3, phone)
      WHERE id = $4
      `,
      [input.name, input.email ?? null, input.phone ?? null, existing.id],
    );

    return {
      ...existing,
      name: input.name,
      email: input.email ?? existing.email,
      phone: input.phone ?? existing.phone,
    };
  }

  const id = crypto.randomUUID();

  await app.pg.query(
    `
    INSERT INTO customers (
      id,
      tenant_id,
      name,
      email,
      phone
    )
    VALUES ($1, $2, $3, $4, $5)
    `,
    [id, input.tenantId, input.name, input.email ?? null, input.phone ?? null],
  );

  const result = await app.pg.query<CustomerRow>(
    `
    SELECT *
    FROM customers
    WHERE id = $1
    LIMIT 1
    `,
    [id],
  );

  return result.rows[0];
}
