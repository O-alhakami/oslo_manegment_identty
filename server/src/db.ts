import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(process.env.NODE_ENV === "production"
    ? { ssl: { rejectUnauthorized: true } }
    : {}),
});

export async function initDB(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      auth_hash TEXT NOT NULL,
      kdf_salt TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vault_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(32) NOT NULL CHECK (category IN ('password', 'identity', 'note')),
      encrypted_data TEXT NOT NULL,
      iv TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS vault_items_user_id_idx ON vault_items(user_id)
  `);
}
