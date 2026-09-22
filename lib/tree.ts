/**
 * ابزارهای کار با درخت (فصل و بخش‌های کتاب).
 *
 * این توابع عمداً «خالص» هستند: هیچ وابستگی‌ای به React، Prisma یا مرورگر ندارند.
 * پس هم در سرور و هم در مرورگر قابل استفاده‌اند و به‌سادگی آزمون واحد می‌شوند.
 *
 * قاعدهٔ مشترک: هر گره فقط `id`، `parentId` و `orderIndex` لازم دارد؛ بقیهٔ
 * ویژگی‌ها دست‌نخورده منتقل می‌شوند (ژنریک).
 */

/** کمینهٔ ویژگی‌های لازم برای ساخت درخت. */
export interface TreeNodeLike {
  id: string;
  parentId: string | null;
  orderIndex: number;
}

/** گرهٔ درختی‌شده همراه فرزندانش. */
export type TreeNode<T extends TreeNodeLike> = T & { children: TreeNode<T>[] };

/**
 * مرتب‌سازی گره‌ها: ابتدا `orderIndex` و در صورت برابر بودن، عنوان (الفبای فارسی).
 *
 * ترتیب پایدار است تا خروجی در همهٔ اجراها یکسان باشد.
 */
export function sortNodes<T extends TreeNodeLike & { title?: string }>(nodes: readonly T[]): T[] {
  return [...nodes].sort((first, second) => {
    if (first.orderIndex !== second.orderIndex) {
      return first.orderIndex - second.orderIndex;
    }

    return (first.title ?? "").localeCompare(second.title ?? "", "fa");
  });
}

/**
 * تبدیل فهرست تخت گره‌ها به درخت.
 *
 * گره‌هایی که والدشان پیدا نشود (مثلاً والدشان حذف شده باشد) در ریشه قرار می‌گیرند
 * تا هیچ گره‌ای در رابط کاربری گم نشود.
 */
export function buildTree<T extends TreeNodeLike>(nodes: readonly T[]): TreeNode<T>[] {
  const sorted = sortNodes(nodes as readonly (T & { title?: string })[]) as T[];
  const childrenByParent = new Map<string | null, T[]>();

  for (const node of sorted) {
    const key = node.parentId;
    const bucket = childrenByParent.get(key);

    if (bucket) {
      bucket.push(node);
    } else {
      childrenByParent.set(key, [node]);
    }
  }

  function attach(node: T): TreeNode<T> {
    const children = childrenByParent.get(node.id) ?? [];

    return { ...node, children: children.map(attach) };
  }

  const rootNodes = childrenByParent.get(null) ?? [];
  const roots = rootNodes.map(attach);

  // گره‌های «یتیم» (والدشان در فهرست نیست) در پایان اضافه می‌شوند.
  const attachedIds = new Set<string>();

  const markAttached = (nodes: TreeNode<T>[]) => {
    for (const node of nodes) {
      attachedIds.add(node.id);
      markAttached(node.children);
    }
  };

  markAttached(roots);

  for (const node of sorted) {
    if (!attachedIds.has(node.id)) {
      roots.push(attach(node));
      markAttached(roots);
    }
  }

  return roots;
}

/** پیمایش عمق‌اول درخت و برگرداندن گره‌ها به‌همراه عمق هر کدام. */
export function flattenTree<T extends TreeNodeLike>(
  tree: readonly TreeNode<T>[],
  depth = 0,
): Array<{ node: TreeNode<T>; depth: number }> {
  const result: Array<{ node: TreeNode<T>; depth: number }> = [];

  for (const node of tree) {
    result.push({ node, depth });
    result.push(...flattenTree(node.children, depth + 1));
  }

  return result;
}

/** شمارش کل گره‌های یک درخت (برای نمایش «X بخش»). */
export function countTreeNodes<T extends TreeNodeLike>(tree: readonly TreeNode<T>[]): number {
  return flattenTree(tree).length;
}

/**
 * شناسهٔ یک گره و همهٔ زیرگره‌هایش.
 *
 * برای هشدار دادن پیش از حذف به کار می‌رود: حذف یک فصل، بخش‌های درونش را هم پاک
 * می‌کند (onDelete: Cascade).
 */
export function collectSubtreeIds<T extends TreeNodeLike>(node: TreeNode<T>): string[] {
  return [node.id, ...(flattenTree(node.children).map((item) => item.node.id) ?? [])];
}

/**
 * درخت گره‌ها را به فهرستی برای `<select>` تبدیل می‌کند.
 *
 * هر گزینه با تورفتگی (`depth`) و عنوان والد نمایش داده می‌شود تا در فرم‌ها
 * انتخاب محل تست ساده باشد.
 */
export function toSelectOptions<T extends TreeNodeLike & { title: string }>(
  tree: readonly TreeNode<T>[],
): Array<{ id: string; label: string; depth: number }> {
  return flattenTree(tree).map(({ node, depth }) => ({
    id: node.id,
    label: `${"— ".repeat(depth)}${node.title}`,
    depth,
  }));
}
