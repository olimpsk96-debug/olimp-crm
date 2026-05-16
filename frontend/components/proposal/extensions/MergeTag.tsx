"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";

/** Custom TipTap node для merge-тегов {{customer.name}}.
 *
 * Хранит path в attrs. При рендере смотрит на window.__mergeData (read-only preview)
 * или отображает плейсхолдер. JSON-форма:
 *   { type: "mergeTag", attrs: { path: "customer.name" } }
 */
export const MergeTagNode = Node.create({
  name: "mergeTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      path: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-merge-tag]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span",
      mergeAttributes({ "data-merge-tag": HTMLAttributes.path }, HTMLAttributes),
      `{{${HTMLAttributes.path}}}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MergeTagView);
  },
});

function MergeTagView({ node }: ReactNodeViewProps) {
  const path = node.attrs.path as string;

  // Резолвим значение из window.__mergeData (передаётся в ProposalEditor через useEffect)
  let resolved: string | null = null;
  if (typeof window !== "undefined") {
    const data = (window as unknown as { __mergeData?: Record<string, Record<string, unknown>> }).__mergeData;
    if (data && path) {
      const [scope, key] = path.split(".");
      const val = scope && key ? data[scope]?.[key] : null;
      if (val !== null && val !== undefined && val !== "") {
        resolved = typeof val === "number"
          ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(val)
          : String(val);
      }
    }
  }

  return (
    <NodeViewWrapper as="span" style={{ display: "inline" }}>
      <span style={{
        padding: "1px 6px", borderRadius: 4,
        background: resolved ? "rgba(74,222,128,0.15)" : "rgba(96,165,250,0.18)",
        color: resolved ? "var(--success)" : "#3b82f6",
        fontFamily: "monospace", fontSize: "0.92em", fontWeight: 500,
        border: "1px dashed currentColor", whiteSpace: "nowrap",
      }} title={resolved ? `Резолвится в: ${resolved}` : `Тег: {{${path}}} — будет подставлен при отправке`}>
        {resolved || `{{${path}}}`}
      </span>
    </NodeViewWrapper>
  );
}
