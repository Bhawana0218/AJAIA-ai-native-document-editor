#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";

const tsExts = new Set([".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"]);

function stripJsComments(code, { keepShebang = true } = {}) {
  let i = 0;
  const n = code.length;
  let out = "";
  let lastSig = "0";
  let lineHasContent = false;
  let mode = "code";
  let swallowAfter = false;
  const stack = [];

  const isWord = (ch) => /[\w$]/.test(ch);
  const regexAllowed = () => {
    if (isWord(lastSig)) {
      const m = out.slice(Math.max(0, out.length - 7), out.length).match(/([A-Za-z]+)$/);
      if (!m) return false;
      return ["return", "typeof", "case", "in", "of", "new", "delete", "void", "do", "else", "yield", "await"].includes(m[1]);
    }
    return "([{,;=!&|?:+-%*<>^~".includes(lastSig);
  };

  const begin = code.startsWith("#!") && keepShebang ? (code.indexOf("\n") + 1 || code.length) : 0;
  out += code.slice(0, begin);
  i = begin;
  lastSig = "0";
  lineHasContent = false;

  const consumeRegex = () => {
    out += code[i];
    i++;
    let inClass = false;
    while (i < n) {
      const rc = code[i];
      if (rc === "\\") {
        out += rc + (code[i + 1] ?? "");
        i += 2;
        continue;
      }
      if (rc === "[") inClass = true;
      else if (rc === "]") inClass = false;
      else if (rc === "/" && !inClass) {
        out += rc;
        i++;
        while (i < n && /[a-z]/.test(code[i])) {
          out += code[i];
          i++;
        }
        return;
      } else if (rc === "\n") {
        return;
      }
      out += rc;
      i++;
    }
  };

  while (i < n) {
    const c = code[i];
    const c2 = i + 1 < n ? code[i + 1] : "";
    const top = stack.length > 0 ? stack[stack.length - 1] : null;

    if (top && top.kind === "str") {
      if (c === "\\") {
        out += c + (c2 || "");
        i += 2;
        continue;
      }
      if (c === top.quote) {
        stack.pop();
        out += c;
        lastSig = "0";
        lineHasContent = true;
        i++;
        continue;
      }
      if (c === "\n") lineHasContent = false;
      out += c;
      i++;
      continue;
    }

    if (top && top.kind === "tplText") {
      if (c === "\\") {
        out += c + (c2 || "");
        i += 2;
        continue;
      }
      if (c === "`") {
        stack.pop();
        out += c;
        lastSig = "0";
        lineHasContent = true;
        i++;
        continue;
      }
      if (c === "$" && c2 === "{") {
        stack.push({ kind: "tplExpr", braces: 0 });
        out += "${";
        i += 2;
        lastSig = "(";
        lineHasContent = true;
        continue;
      }
      if (c === "\n") lineHasContent = false;
      out += c;
      i++;
      continue;
    }

    if (top && top.kind === "tplExpr") {
      if (c === "'" || c === '"') {
        stack.push({ kind: "str", quote: c });
        out += c;
        lastSig = "0";
        lineHasContent = true;
        i++;
        continue;
      }
      if (c === "`") {
        stack.push({ kind: "tplText" });
        out += c;
        lastSig = "0";
        lineHasContent = false;
        i++;
        continue;
      }
      if (c === "/" && c2 === "/") {
        while (i < n && code[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && c2 === "*") {
        const end = code.indexOf("*/", i + 2);
        i = end === -1 ? n : end + 2;
        continue;
      }
      if (c === "/" && regexAllowed()) {
        consumeRegex();
        lastSig = "0";
        continue;
      }
      if (c === "{") {
        top.braces++;
        out += c;
        lastSig = "{";
        lineHasContent = true;
        i++;
        continue;
      }
      if (c === "}") {
        if (top.braces === 0) {
          stack.pop();
          out += "}";
          lastSig = "0";
          lineHasContent = true;
        } else {
          top.braces--;
          out += "}";
          lastSig = "}";
          lineHasContent = true;
        }
        i++;
        continue;
      }
      if (c === "\n") lineHasContent = false;
      out += c;
      if (!/\s/.test(c)) {
        lastSig = c;
        lineHasContent = true;
      }
      i++;
      continue;
    }

    switch (mode) {
      case "line": {
        if (c === "\n") {
          if (lineHasContent) {
            out += code[i - 1] === "\r" ? "\r\n" : "\n";
            lineHasContent = false;
          }
          mode = "code";
        }
        i++;
        continue;
      }
      case "block": {
        if (c === "*" && c2 === "/") {
          mode = "code";
          i += 2;
          if (swallowAfter) {
            swallowAfter = false;
            while (i < n && (code[i] === " " || code[i] === "\t")) i++;
            if (code[i] === "\r") i++;
            if (code[i] === "\n") i++;
          }
          continue;
        }
        i++;
        continue;
      }
      default: {
        if (c === "/" && c2 === "/") {
          mode = "line";
          i += 2;
          continue;
        }
        if (c === "/" && c2 === "*") {
          swallowAfter = !lineHasContent;
          mode = "block";
          i += 2;
          continue;
        }
        if (c === "'" || c === '"') {
          stack.push({ kind: "str", quote: c });
          out += c;
          lastSig = "0";
          lineHasContent = true;
          i++;
          continue;
        }
        if (c === "`") {
          stack.push({ kind: "tplText" });
          out += c;
          lastSig = "0";
          lineHasContent = false;
          i++;
          continue;
        }
        if (c === "/" && regexAllowed()) {
          consumeRegex();
          lastSig = "0";
          continue;
        }
        if (c === "\n") lineHasContent = false;
        out += c;
        if (!/\s/.test(c)) {
          lastSig = c;
          lineHasContent = true;
        }
        i++;
        continue;
      }
    }
  }
  return out;
}

function stripOtherComments(code, file) {
  if (file.endsWith(".sql")) {
    return code.replace(/--[^\n]*/g, "").replace(/\n{3,}/g, "\n\n");
  }
  if (file.endsWith(".css")) {
    return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n{3,}/g, "\n\n");
  }
  return code;
}

const changed = [];

function processFile(p) {
  const before = readFileSync(p, "utf8");
  const ext = extname(p).toLowerCase();
  let after;
  if (tsExts.has(ext)) after = stripJsComments(before);
  else if (ext === ".css" || ext === ".sql") after = stripOtherComments(before, p);
  else return;
  if (after !== before) {
    writeFileSync(p, after);
    changed.push(p);
  }
}

function walk(dir) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".next", ".git", ".vercel"].includes(f.name)) continue;
    const p = join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else processFile(p);
  }
}

function main() {
  const roots = ["src", "scripts", "tests", "assets.d.ts", "next.config.ts", "vitest.config.ts", "eslint.config.mjs", "next-env.d.ts"];
  for (const r of roots) {
    try {
      const st = statSync(r);
      if (st.isDirectory()) walk(r);
      else processFile(r);
    } catch {
          }
  }
  console.log(`stripped comments in ${changed.length} file(s)`);
  console.log(changed.join("\n"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { stripJsComments, stripOtherComments };
