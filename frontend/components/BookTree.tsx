"use client";

import { NODE_TYPE_LABELS } from "@/lib/labels";
import { formatCount } from "@/lib/format";
import type { BookNode } from "@/types";
import { cx } from "@/components/ui";

function NodeRow({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: BookNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const active = node.id === selectedId;
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-right text-sm transition",
          active ? "bg-foam text-pine-dark" : "hover:bg-black/5",
        )}
        style={{ paddingRight: `${0.75 + depth * 0.9}rem` }}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">{node.title}</span>
          <span className="text-xs text-muted">{NODE_TYPE_LABELS[node.node_type]}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs text-muted">
          {formatCount(node.question_count)}
        </span>
      </button>
      {node.children.map((child) => (
        <NodeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function BookTree({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: BookNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (nodes.length === 0) {
    return <p className="px-1 text-sm leading-7 text-muted">هنوز فصل یا بخشی ساخته نشده.</p>;
  }
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <NodeRow key={node.id} node={node} depth={0} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}
