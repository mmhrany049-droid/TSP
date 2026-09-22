import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTree,
  collectSubtreeIds,
  countTreeNodes,
  flattenTree,
  sortNodes,
  toSelectOptions,
} from "./tree.ts";

/** نمونهٔ گره‌های ساختار کتاب: دو فصل، یک بخش در فصل اول و یک زیربخش. */
const nodes = [
  { id: "s1", parentId: "c1", title: "بخش ۱", orderIndex: 1 },
  { id: "c2", parentId: null, title: "فصل ۲", orderIndex: 2 },
  { id: "c1", parentId: null, title: "فصل ۱", orderIndex: 1 },
  { id: "ss1", parentId: "s1", title: "زیربخش ۱", orderIndex: 1 },
];

describe("sortNodes", () => {
  it("ابتدا بر اساس ترتیب و سپس بر اساس عنوان مرتب می‌کند", () => {
    const sorted = sortNodes([
      { id: "b", parentId: null, title: "ب", orderIndex: 1 },
      { id: "a", parentId: null, title: "الف", orderIndex: 1 },
      { id: "c", parentId: null, title: "ج", orderIndex: 0 },
    ]);

    assert.deepEqual(
      sorted.map((node) => node.id),
      ["c", "a", "b"],
    );
  });

  it("آرایهٔ ورودی را تغییر نمی‌دهد", () => {
    const input = [
      { id: "b", parentId: null, orderIndex: 2 },
      { id: "a", parentId: null, orderIndex: 1 },
    ];

    sortNodes(input);

    assert.equal(input[0].id, "b");
  });
});

describe("buildTree", () => {
  it("ساختار تودرتو را از فهرست تخت می‌سازد", () => {
    const tree = buildTree(nodes);

    assert.equal(tree.length, 2);
    assert.equal(tree[0].id, "c1");
    assert.equal(tree[0].children.length, 1);
    assert.equal(tree[0].children[0].id, "s1");
    assert.equal(tree[0].children[0].children[0].id, "ss1");
    assert.equal(tree[1].id, "c2");
  });

  it("گره‌های یتیم (والد ناموجود) را در ریشه نگه می‌دارد", () => {
    const tree = buildTree([{ id: "x", parentId: "missing", title: "بی‌والد", orderIndex: 0 }]);

    assert.equal(tree.length, 1);
    assert.equal(tree[0].id, "x");
  });

  it("مرتب‌سازی را در همهٔ سطوح اعمال می‌کند", () => {
    const tree = buildTree([
      { id: "p", parentId: null, title: "والد", orderIndex: 0 },
      { id: "z", parentId: "p", title: "ب", orderIndex: 2 },
      { id: "y", parentId: "p", title: "الف", orderIndex: 1 },
    ]);

    assert.deepEqual(
      tree[0].children.map((child) => child.id),
      ["y", "z"],
    );
  });

  it("برای فهرست خالی، درخت خالی می‌دهد", () => {
    assert.deepEqual(buildTree([]), []);
  });
});

describe("flattenTree", () => {
  it("همهٔ گره‌ها را با عمق درست برمی‌گرداند", () => {
    const rows = flattenTree(buildTree(nodes));

    assert.deepEqual(
      rows.map((row) => [row.node.id, row.depth]),
      [
        ["c1", 0],
        ["s1", 1],
        ["ss1", 2],
        ["c2", 0],
      ],
    );
  });

  it("countTreeNodes شمار کل گره‌ها را می‌دهد", () => {
    assert.equal(countTreeNodes(buildTree(nodes)), 4);
  });
});

describe("collectSubtreeIds", () => {
  it("شناسهٔ گره و همهٔ زیرگره‌هایش را برمی‌گرداند", () => {
    const tree = buildTree(nodes);
    const chapterOne = tree[0];

    assert.deepEqual(collectSubtreeIds(chapterOne), ["c1", "s1", "ss1"]);
  });

  it("برای برگ، فقط شناسهٔ خودش را می‌دهد", () => {
    const leaf = buildTree(nodes)[1];

    assert.deepEqual(collectSubtreeIds(leaf), ["c2"]);
  });
});

describe("toSelectOptions", () => {
  it("برچسب گزینه‌ها را با تورفتگی عمق می‌سازد", () => {
    const options = toSelectOptions(buildTree(nodes));

    assert.deepEqual(options, [
      { id: "c1", label: "فصل ۱", depth: 0 },
      { id: "s1", label: "— بخش ۱", depth: 1 },
      { id: "ss1", label: "— — زیربخش ۱", depth: 2 },
      { id: "c2", label: "فصل ۲", depth: 0 },
    ]);
  });
});
