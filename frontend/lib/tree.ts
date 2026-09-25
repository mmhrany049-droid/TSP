import type { BookNode } from "@/types";

export function findNode(nodes: BookNode[], id: string): BookNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = findNode(node.children, id);
    if (nested) return nested;
  }
  return null;
}

export function flattenNodes(nodes: BookNode[], depth = 0): Array<{ node: BookNode; depth: number }> {
  return nodes.flatMap((node) => [{ node, depth }, ...flattenNodes(node.children, depth + 1)]);
}
