/**
 * Tests for the .txt/.md import converters (src/lib/import.ts).
 */
import { describe, expect, it } from "vitest";
import { convertImport, markdownToProseMirror, textToProseMirror } from "@/lib/import";

describe("markdownToProseMirror", () => {
  it("builds headings, lists, bold and code", () => {
    const { doc, title } = markdownToProseMirror(
      "# My Title\n\nA **bold** claim and `code`.\n\n- one\n- two\n\n1. first\n2. second\n",
    );
    expect(title).toBe("My Title");
    const blocks = doc.content ?? [];
    expect(blocks[0].type).toBe("heading");
    expect(blocks[0].attrs).toEqual({ level: 1 });
    expect(blocks[2].type).toBe("bulletList");
    expect(blocks[2].content?.length).toBe(2);
    expect(blocks[3].type).toBe("orderedList");
    // bold mark present in paragraph
    const para = blocks[1].content ?? [];
    expect(para.some((n) => n.marks?.[0]?.type === "bold")).toBe(true);
  });

  it("extracts the title from the first heading and strips markdown chars", () => {
    const { title } = markdownToProseMirror("# **Release** notes\n");
    expect(title).toBe("Release notes");
  });

  it("converts fenced code blocks", () => {
    const { doc } = markdownToProseMirror("```\nconst x = 1;\n```\n");
    expect(doc.content?.[0].type).toBe("codeBlock");
    expect(doc.content?.[0].content?.[0].text).toBe("const x = 1;");
  });

  it("handles links and inline italics", () => {
    const { doc } = markdownToProseMirror("See [docs](https://example.com) and *italic*.\n");
    const p = doc.content?.[0];
    expect(p?.type).toBe("paragraph");
    const texts = (p?.content ?? []).map((n) => n.text);
    expect(texts.join("")).toContain("docs");
    expect((p?.content ?? []).some((n) => n.marks?.[0]?.type === "italic")).toBe(true);
  });

  it("always returns at least one block", () => {
    expect(markdownToProseMirror("").doc.content?.length).toBeGreaterThan(0);
  });
});

describe("textToProseMirror", () => {
  it("splits blank-line-separated paragraphs", () => {
    const { doc, title } = textToProseMirror("First para\nsecond line\n\nSecond para\n");
    expect(doc.content?.length).toBe(2);
    expect(title).toBe("First para");
  });

  it("preserves internal line breaks as hard breaks", () => {
    const { doc } = textToProseMirror("alpha\nbeta\n\ngamma\n");
    const p = doc.content?.[0];
    expect(p?.content?.some((n) => n.type === "hardBreak")).toBe(true);
  });

  it("falls back to an empty paragraph", () => {
    expect(textToProseMirror("").doc.content?.length).toBe(1);
  });
});

describe("convertImport dispatch", () => {
  it("routes .md to markdown", () => {
    expect(convertImport("notes.md", "# hi")?.kind).toBe("markdown");
    expect(convertImport("x.markdown", "# hi")?.kind).toBe("markdown");
  });
  it("routes .txt to text", () => {
    expect(convertImport("plain.txt", "hello")?.kind).toBe("text");
  });
  it("rejects unsupported formats", () => {
    expect(convertImport("doc.pdf", "…")).toBeNull();
    expect(convertImport("image.png", "…")).toBeNull();
    expect(convertImport("docx", "…")).toBeNull();
  });
});
