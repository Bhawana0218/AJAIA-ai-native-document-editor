import postgres from "postgres";

declare global {
  var __ajaiaSql: postgres.Sql | undefined;
}

function createSql(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  const sslRequired = process.env.DATABASE_SSL === "require";
  // Pool sizing: hosted serverless platforms fan out many small instances, so
  // keep the per-instance pool small when SSL/hosted Postgres is in use.
  const poolMax = process.env.DATABASE_POOL_MAX
    ? Math.max(1, Number(process.env.DATABASE_POOL_MAX))
    : sslRequired
      ? 3
      : 10;
  return postgres(url, {
    ssl: sslRequired ? "require" : undefined,
    max: poolMax,
    idle_timeout: 30,
    connect_timeout: 10,
    // Transaction-poolers (e.g. Supabase 6543, Neon pooler) cannot mix
    // prepared statements across connections; opt out via env when needed.
    prepare: process.env.DATABASE_PREPARE === "false" ? false : true,
  });
}

/** Shared postgres.js client (singleton across hot reloads). */
export const sql: postgres.Sql = globalThis.__ajaiaSql ?? createSql();

if (process.env.NODE_ENV !== "production") {
  globalThis.__ajaiaSql = sql;
}

export type User = {
  id: string;
  email: string;
  name: string;
  created_at: Date;
};

export type DocumentRecord = {
  id: string;
  owner_id: string;
  title: string;
  content: unknown;
  created_at: Date;
  updated_at: Date;
};

export type ShareRecord = {
  id: string;
  document_id: string;
  recipient_id: string;
  role: "viewer" | "editor";
  created_at: Date;
};

export type ShareWithUser = ShareRecord & {
  recipient_email: string;
  recipient_name: string;
};
