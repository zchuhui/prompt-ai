export type EditorAsset = {
  assetId: string;
  position: number;
  alt: string | null;
  status: string;
  width: number | null;
  height: number | null;
  errorCode?: string | null;
};

export type EditorPrompt = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  promptText: string;
  negativePrompt: string | null;
  usageNotes: string | null;
  parametersText: string | null;
  modelVersion: string | null;
  aspectRatio: string | null;
  requiresReference: boolean;
  sourceType: "original" | "collected";
  sourceAuthor: string | null;
  sourceUrl: string | null;
  categoryId: string | null;
  modelId: string | null;
  status: "draft" | "published";
  coverAssetId: string | null;
  version: number;
  publishedAt: string | null;
  updatedAt: string;
  tagIds: string[];
  assetItems: EditorAsset[];
};

/**
 * The worker attaches uploaded images without bumping the prompt version, so
 * the editor folds server-side additions into its unsaved local state instead
 * of replacing it.
 */
export function mergeServerAssets(
  local: EditorPrompt,
  server: EditorPrompt,
  removedLocally: ReadonlySet<string>,
): EditorPrompt {
  const serverById = new Map(server.assetItems.map((item) => [item.assetId, item]));
  const kept = local.assetItems.map((item) => {
    const fresh = serverById.get(item.assetId);
    return fresh
      ? { ...item, status: fresh.status, width: fresh.width, height: fresh.height, errorCode: fresh.errorCode }
      : item;
  });
  const known = new Set(kept.map((item) => item.assetId));
  const added = server.assetItems.filter(
    (item) => !known.has(item.assetId) && !removedLocally.has(item.assetId),
  );
  const assetItems = [...kept, ...added];
  const coverAssetId =
    local.coverAssetId && assetItems.some((item) => item.assetId === local.coverAssetId)
      ? local.coverAssetId
      : (server.coverAssetId ?? assetItems[0]?.assetId ?? null);
  return { ...local, assetItems, coverAssetId };
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

export function toPatch(prompt: EditorPrompt, includeSlug: boolean) {
  return {
    version: prompt.version,
    ...(includeSlug ? { slug: prompt.slug } : {}),
    title: prompt.title,
    summary: prompt.summary,
    promptText: prompt.promptText,
    negativePrompt: prompt.negativePrompt,
    usageNotes: prompt.usageNotes,
    parametersText: prompt.parametersText,
    modelVersion: prompt.modelVersion,
    aspectRatio: prompt.aspectRatio,
    requiresReference: prompt.requiresReference,
    sourceType: prompt.sourceType,
    sourceAuthor: prompt.sourceAuthor,
    sourceUrl: prompt.sourceUrl?.trim() ? prompt.sourceUrl.trim() : null,
    categoryId: prompt.categoryId,
    modelId: prompt.modelId,
    tagIds: prompt.tagIds,
    coverAssetId: prompt.coverAssetId,
    assetItems: prompt.assetItems.map((item, index) => ({
      assetId: item.assetId,
      position: index,
      alt: item.alt?.trim() ? item.alt.trim() : null,
    })),
  };
}
