import bcrypt from "bcryptjs";
import type { Pool } from "pg";

const SALT_ROUNDS = 12;

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string | null;
}

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const createUser = async (
  pg: Pool,
  email: string,
  password: string,
  name: string,
  role: string = "user",
): Promise<PublicUser> => {
  const passwordHash = await hashPassword(password);

  const result = await pg.query<User>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, tenant_id, created_at, updated_at`,
    [email, passwordHash, name, role],
  );

  const user = result.rows[0];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
  };
};

export const findUserByEmail = async (
  pg: Pool,
  email: string,
): Promise<User | null> => {
  const result = await pg.query<User>(
    `SELECT id, email, password_hash, name, role, tenant_id, created_at, updated_at
     FROM users
     WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
};

export const getUserById = async (
  pg: Pool,
  id: string,
): Promise<PublicUser | null> => {
  const result = await pg.query<User>(
    `SELECT id, email, name, role, tenant_id
     FROM users
     WHERE id = $1`,
    [id],
  );

  const user = result.rows[0];
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tenant_id: user.tenant_id,
  };
};
