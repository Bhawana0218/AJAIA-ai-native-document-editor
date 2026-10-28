#!/usr/bin/env node
// Seeds demo accounts and sample documents so permission behavior can be
// verified immediately. Safe to run multiple times (idempotent).
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import postgres from "postgres";
import { loadEnv } from "./env.mjs";

loadEnv();

const scrypt = promisify(scryptCb);
const sql = postgres(process.env.DATABASE_URL ?? "postgres://ajaia:ajaia@localhost:5433/ajaia_docs", {
  ssl: process.env.DATABASE_SSL === "require" ? "require" : undefined,
});

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const PASSWORD = "demo1234";

const users = [
  { email: "alice@demo.dev", name: "Alice Chen" },
  { email: "bob@demo.dev", name: "Bob Rivera" },
  { email: "carol@demo.dev", name: "Carol Nyeko" },
];

function text(text, bold = false) {
  return { type: "text", text, ...(bold ? { marks: [{ type: "bold" }] } : {}) };
}
function para(...content) {
  return { type: "paragraph", content };
}
function heading(level, ...content) {
  return { type: "heading", attrs: { level }, content };
}

const sampleDocs = {
  prd: {
    title: "Product Requirements — Docs MVP",
    owner: "alice@demo.dev",
    shares: [{ email: "bob@demo.dev", role: "editor" }],
    content: {
      type: "doc",
      content: [
        heading(1, text("Ajaia Docs — Product Requirements")),
        para(
          text("Goal: ship a focused, reliable collaborative document editor. "),
          text("Quality over feature count.", true),
        ),
        heading(2, text("Scope")),
        { type: "bulletList", content: [
          { type: "listItem", content: para(text("Document CRUD with autosave")) },
          { type: "listItem", content: para(text("Sharing with enforced viewer/editor roles")) },
          { type: "listItem", content: para(text("Import .txt and .md files")) },
        ] },
        heading(2, text("Non-goals")),
        { type: "orderedList", content: [
          { type: "listItem", content: para(text("Comment threads (post-MVP)")) },
          { type: "listItem", content: para(text("Version history (post-MVP)")) },
        ] },
      ],
    },
  },
  notes: {
    title: "Meeting Notes — Kickoff",
    owner: "alice@demo.dev",
    shares: [{ email: "carol@demo.dev", role: "viewer" }],
    content: {
      type: "doc",
      content: [
        heading(2, text("Kickoff — Monday")),
        para(text("Discussed the timebox and the priority order. ")),
        { type: "blockquote", content: [para(text("Working editor and real persistence first. Sharing next. Import after."))] },
        para(text("Owner: "), text("Alice", true)),
      ],
    },
  },
  personal: {
    title: "Personal Brainstorm",
    owner: "alice@demo.dev",
    shares: [],
    content: {
      type: "doc",
      content: [
        para(text("Ideas for the dashboard: ", false), text("search first, import second.", true)),
        { type: "codeBlock", content: [{ type: "text", text: "npm run dev\nnpm test" }] },
      ],
    },
  },
  boba: {
    title: "Reading List",
    owner: "bob@demo.dev",
    shares: [{ email: "alice@demo.dev", role: "viewer" }],
    content: {
      type: "doc",
      content: [
        heading(1, text("Reading List")),
        { type: "bulletList", content: [
          { type: "listItem", content: para(text("Designing Data-Intensive Applications")) },
          { type: "listItem", content: para(text("The Pragmatic Programmer")) },
        ] },
      ],
    },
  },
};

const inserted = {};
for (const u of users) {
  const hash = await hashPassword(PASSWORD);
  const rows = await sql`
    insert into users (email, name, password_hash)
    values (${u.email}, ${u.name}, ${hash})
    on conflict (email) do update set name = excluded.name
    returning id, email`;
  inserted[u.email] = rows[0];
  console.log(`user ${u.email} -> ${rows[0].id}`);
}

for (const doc of Object.values(sampleDocs)) {
  const owner = inserted[doc.owner];
  const exists = await sql`
    select id from documents where owner_id = ${owner.id} and title = ${doc.title} limit 1`;
  if (exists.length > 0) {
    console.log(`document "${doc.title}" already seeded, skipping`);
    continue;
  }
  const rows = await sql`
    insert into documents (owner_id, title, content)
    values (${owner.id}, ${doc.title}, ${sql.json(doc.content)}::jsonb)
    returning id`;
  const docId = rows[0].id;
  for (const share of doc.shares) {
    await sql`
      insert into document_shares (document_id, recipient_id, role)
      values (${docId}, ${inserted[share.email].id}, ${share.role})`;
  }
  console.log(`document "${doc.title}" -> ${docId} (${doc.shares.length} shares)`);
}

console.log(`\nSeeded. All demo accounts use password: ${PASSWORD}`);
console.log("  alice@demo.dev  — owner of 3 sample docs");
console.log("  bob@demo.dev    — editor on 'Product Requirements', owner of 'Reading List'");
console.log("  carol@demo.dev  — viewer on 'Meeting Notes — Kickoff'");
await sql.end();
