"use client";

import type { Editor } from "@tiptap/react";
import {
  EyeIcon,
  TextIcon,
} from "@/components/icons";

function ToolButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean },
) {
  const { active, className = "", ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-ink-600 transition-colors hover:bg-zinc-100 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40 aria-[pressed=true]:bg-accent-50 aria-[pressed=true]:text-accent-700 ${className}`}
      aria-pressed={active}
    />
  );
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true" />;
}

const MARK_META = [
  { cmd: "bold", label: "B", title: "Bold (Ctrl+B)", className: "font-bold" },
  { cmd: "italic", label: "I", title: "Italic (Ctrl+I)", className: "italic" },
  { cmd: "underline", label: "U", title: "Underline (Ctrl+U)", className: "underline" },
  { cmd: "strike", label: "S", title: "Strikethrough", className: "line-through" },
  { cmd: "code", label: "</>", title: "Code", className: "text-xs font-mono" },
] as const;

const BLOCK_META = [
  { cmd: "heading", level: 1, label: "H1", title: "Heading 1" },
  { cmd: "heading", level: 2, label: "H2", title: "Heading 2" },
  { cmd: "heading", level: 3, label: "H3", title: "Heading 3" },
] as const;

export function EditorToolbar({ editor }: { editor: Editor | null }) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      role="toolbar"
      aria-label="Text formatting"
      aria-controls={editor ? "document-editor" : undefined}
    >
      {BLOCK_META.map(({ cmd, level, label, title }) => (
        <ToolButton
          key={`${cmd}${level}`}
          title={title}
          aria-label={title}
          disabled={!editor}
          active={editor?.isActive(cmd, { level }) ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()}
          className="w-9 text-xs font-semibold"
        >
          {label}
        </ToolButton>
      ))}
      <Separator />
      {editor ? (
        <>
          <ToolButton
            title="Bullet list"
            aria-label="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="6" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="5" cy="18" r="1.2" fill="currentColor" stroke="none" />
              <path d="M9 6h11M9 12h11M9 18h11" />
            </svg>
          </ToolButton>
          <ToolButton
            title="Numbered list"
            aria-label="Numbered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <text x="3" y="8" fontSize="8" fill="currentColor" stroke="none">1.</text>
              <text x="3" y="16" fontSize="8" fill="currentColor" stroke="none">2.</text>
              <path d="M10 6h10M10 14h10" />
            </svg>
          </ToolButton>
          <ToolButton
            title="Block quote"
            aria-label="Block quote"
            active={editor.isActive("blockquote")}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M6 16c-1.5 0-3-1.2-3-3.4C3 9.9 4.7 7.7 7.4 6.8l.5 1.2C6.3 8.8 5.5 9.9 5.4 11 5.6 11 5.8 11 6 11c1.4 0 2.5 1 2.5 2.5S7.4 16 6 16Zm9 0c-1.5 0-3-1.2-3-3.4 0-2.7 1.7-4.9 4.4-5.8l.5 1.2c-1.6.8-2.4 1.9-2.5 3 .2 0 .4 0 .6 0 1.4 0 2.5 1 2.5 2.5S16.4 16 15 16Z" />
            </svg>
          </ToolButton>
          <ToolButton
            title="Horizontal rule"
            aria-label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
          <Separator />
          {MARK_META.map(({ cmd, label, title, className }) => (
            <ToolButton
              key={cmd}
              title={title}
              aria-label={title}
              active={editor.isActive(cmd)}
              onClick={() => editor.chain().focus().toggleMark(cmd).run()}
              className={className}
            >
              {label}
            </ToolButton>
          ))}
          <ToolButton
            title="Clear formatting"
            aria-label="Clear formatting"
            onClick={() => editor.chain().focus().unsetAllMarks().run()}
          >
            <TextIcon size={15} />
          </ToolButton>
        </>
      ) : (
        <span className="flex items-center gap-1 px-2 text-xs text-ink-400">
          <EyeIcon size={14} />
          Read-only
        </span>
      )}
    </div>
  );
}

export function ViewerNotice({ ownerName }: { ownerName: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <EyeIcon size={14} />
      You have view-only access (shared by {ownerName}). Edits are disabled.
    </div>
  );
}
