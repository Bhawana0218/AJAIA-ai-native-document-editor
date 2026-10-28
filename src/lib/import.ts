/**
 * Server-side converter for imported .txt and .md files into ProseMirror
 * (Tiptap) document JSON. Deliberately small and dependency-free.
 *
 * Supported Markdown subset (see docs: ARCHITECTURE.md):
 *  - ATX headings (# .. ####)
 *  - Bullet lists (-, *, +) and ordered lists (1., 2) with explicit start numbers
 *  - Fenced code blocks ```lang
 *  - Blockquotes (>)
 *  - Horizontal rules (---, ***)
 *  - Paragraphs, hard line breaks preserved inside paragraphs
 *  - Inline: **bold**, *italic* / _italic_, `code`, ~~strike~~, [text](url)
 *
 * .txt files become paragraphs split on blank lines; lines within a
 * paragraph are joined with hard breaks.
 */

export type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type ImportResult = {
  doc: ProseMirrorNode;
  title: string;
};

export function emptyDoc(): ProseMirrorNode {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

// ---------------- inline parsing ----------------

type InlineToken = { text: string; marks: string[] };

function parseInline(text: string): InlineToken[] {
  // Ordered by delimiters; each pass consumes matched segments.
  const patterns: { re: RegExp; mark: string }[] = [
    { re: /\*\*([^*]+)\*\*|__([^_]+)__/g, mark: "bold" },
    { re: /\*([^*]+)\*|_([^_]+)_/g, mark: "italic" },
    { re: /~~([^~]+)~~/g, mark: "strike" },
    { re: /`([^`]+)`/g, mark: "code" },
    { re: /!\[.*?\]\((.*?)\)/g, mark: "__skipImage__" },
    { re: /\[([^\]]+)\]\(([^)\s]+)\)/g, mark: "__link__" },
  ];

  let tokens: InlineToken[] = [{ text, marks: [] }];

  for (const { re, mark } of patterns) {
    const next: InlineToken[] = [];
    for (const tok of tokens) {
      if (tok.marks.includes("code") || tok.text.length === 0) {
        next.push(tok);
        continue;
      }
      let lastIndex = 0;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(tok.text)) !== null) {
        if (m.index > lastIndex) {
          next.push({ text: tok.text.slice(lastIndex, m.index), marks: tok.marks });
        }
        if (mark === "__link__") {
          next.push({ text: m[1], marks: [...tok.marks] });
        } else if (mark !== "__skipImage__") {
          next.push({ text: m[1] ?? m[2], marks: [...tok.marks, mark] });
        }
        // skipImage: text is dropped intentionally
        lastIndex = m.index + m[0].length;
      }
      if (lastIndex < tok.text.length) {
        next.push({ text: tok.text.slice(lastIndex), marks: tok.marks });
      }
    }
    tokens = next;
  }

  return tokens
    .filter((t) => t.text.length > 0)
    .map((t) => ({
      text: t.text,
      marks: t.marks.filter((m) => m !== "__link__"),
    }));
}

function textNodes(tokens: InlineToken[]): ProseMirrorNode[] {
  return tokens.map((t) => ({
    type: "text",
    text: t.text,
    ...(t.marks.length > 0 ? { marks: t.marks.map((mark) => ({ type: mark })) } : {}),
  }));
}

// ---------------- block parsing ----------------

export function markdownToProseMirror(markdown: string): ImportResult {
  const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: ProseMirrorNode[] = [];

  // Title: first possible user-provided heading, or fallback given by caller.
  let title: string | null = null;

  let i = 0;
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const raw = paragraph.join("\n").trim();
    paragraph = [];
    if (raw.length === 0) return;
    const tokens = parseInline(raw);
    if (tokens.length === 0) return;
    blocks.push({ type: "paragraph", content: textNodes(tokens) });
  };

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trimStart().startsWith("```")) {
      flushParagraph();
      i++;
      const code: string[] = [];
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        code.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: "codeBlock", content: [{ type: "text", text: code.join("\n") }] });
      continue;
    }

    // horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushParagraph();
      blocks.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // blockquote
    if (/^\s*>\s?/.test(line)) {
      flushParagraph();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const tokens = parseInline(quote.join(" ").trim());
      blocks.push({
        type: "blockquote",
        content:
          tokens.length > 0
            ? [{ type: "paragraph", content: textNodes(tokens) }]
            : [{ type: "paragraph" }],
      });
      continue;
    }

    // heading
    const heading = line.match(/^\s*(#{1,4})\s+(.*\S)\s*$/);
    if (heading) {
      flushParagraph();
      if (title === null) title = heading[2].replace(/[#_*`]/g, "").trim();
      blocks.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: textNodes(parseInline(heading[2])),
      });
      i++;
      continue;
    }

    // lists (bullet / ordered), consecutive entries grouped
    const bullet = line.match(/^\s*[-*+]\s+(.*\S)\s*$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*\S)\s*$/);
    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const start = isOrdered ? Number(ordered![1]) : 1;
      const items: ProseMirrorNode[] = [];
      while (i < lines.length) {
        const bm = lines[i].match(/^\s*[-*+]\s+(.*\S)\s*$/);
        const om = lines[i].match(/^\s*(\d+)[.)]\s+(.*\S)\s*$/);
        if (isOrdered && om) {
          items.push({ type: "listItem", content: textNodes(parseInline(om[2])) });
        } else if (!isOrdered && bm) {
          items.push({ type: "listItem", content: textNodes(parseInline(bm[1])) });
        } else if (/^\s*$/.test(lines[i])) {
          i++;
          break; // blank line ends the list
        } else {
          break;
        }
        i++;
      }
      blocks.push({
        type: isOrdered ? "orderedList" : "bulletList",
        ...(isOrdered && start !== 1 ? { attrs: { start } } : {}),
        content: items,
      });
      continue;
    }

    // blank line ends paragraph
    if (/^\s*$/.test(line)) {
      flushParagraph();
      i++;
      continue;
    }

    paragraph.push(line.replace(/^\s+/, ""));
    i++;
  }
  flushParagraph();

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph" });
  }

  return { doc: { type: "doc", content: blocks }, title: title ?? (null as unknown as string) };
}

export function textToProseMirror(text: string): ImportResult {
  const paragraphs = text
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.split("\n").map((l) => l.replace(/\s+$/, "")).filter((l) => l.length > 0))
    .filter((lines) => lines.length > 0);

  const blocks: ProseMirrorNode[] = paragraphs.map((lines) => {
    if (lines.length === 1) {
      return { type: "paragraph", content: [{ type: "text", text: lines[0] }] };
    }
    // Multi-line text paragraphs: first line as text, subsequent as hard breaks
    const content: ProseMirrorNode[] = [];
    lines.forEach((l, idx) => {
      if (idx > 0) content.push({ type: "hardBreak" });
      content.push({ type: "text", text: l });
    });
    return { type: "paragraph", content };
  });

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph" });
    const title = (text.split("\n")[0] ?? "").trim().slice(0, 80) || "Untitled";
    return { doc: { type: "doc", content: blocks }, title };
  }

  const title = (text.split("\n")[0] ?? "").trim().slice(0, 80) || "Untitled";
  return { doc: { type: "doc", content: blocks }, title };
}

export const IMPORT_EXTENSIONS = ["txt", "md", "markdown"] as const;

/** Picks the right converter for a filename; null when the type is unsupported. */
export function convertImport(
  filename: string,
  body: string,
): { doc: ProseMirrorNode; title: string; kind: "markdown" | "text" } | null {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "md" || ext === "markdown") {
    const res = markdownToProseMirror(body);
    return { ...res, kind: "markdown" };
  }
  if (ext === "txt") {
    const res = textToProseMirror(body);
    return { ...res, kind: "text" };
  }
  return null;
}
