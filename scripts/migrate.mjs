#!/usr/bin/env node
// Runs all SQL migrations in migrations/ in sorted order, exactly once each.
// Tracks applied migrations in the _migrations table.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { loadEnv } from "./env.mjs";

loadEnv();

const sql = postgres(process.env.DATABASE_URL ?? "postgres://ajaia:ajaia@localhost:5433/ajaia_docs", {
  ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
});

try {
  await sql`create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`;

  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migrations found.");
  }

  for (const file of files) {
    const applied = await sql`select 1 from _migrations where name = ${file}`;
    if (applied.length > 0) {
      console.log(`= ${file} already applied, skipping`);
      continue;
    }
    const query = readFileSync(join(dir, file), "utf8");
    // postgres.js supports multi-statement files via sql.unsafe
    await sql.unsafe(query);
    await sql`insert into _migrations (name) values (${file})`;
    console.log(`+ applied ${file}`);
  }
  console.log("Migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
