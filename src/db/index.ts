import postgres from "postgres";

declare global {
  var __ajaiaSql: postgres.Sql | undefined;
}

function createSql(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  return postgres(url, {
    ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
    max: 10,
    idle_timeout: 30,
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
