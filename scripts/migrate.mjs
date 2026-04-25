import "dotenv/config";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const sqlDir = path.resolve("sql");

const run = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    for (const file of files) {
      const sql = await readFile(path.join(sqlDir, file), "utf8");
      await pool.query(sql);
      console.log(`Applied ${file}`);
    }
  } finally {
    await pool.end();
  }
};

void run();
