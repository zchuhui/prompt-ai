import { SEARCH_QUERY_MAX } from "@/shared/constants";

export type GalleryParams = {
  q: string;
  category: string;
  model: string;
  tags: string[];
};

type RawSearch = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((tag) => tag.trim()).filter(Boolean))].sort();
}

export function parseGalleryParams(search: RawSearch): GalleryParams {
  return {
    q: one(search.q).trim().slice(0, SEARCH_QUERY_MAX),
    category: one(search.category).trim(),
    model: one(search.model).trim(),
    tags: parseTags(one(search.tags)),
  };
}

export function isFiltered(params: GalleryParams): boolean {
  return Boolean(params.q || params.category || params.model || params.tags.length > 0);
}

/** Query string in canonical key order, without a leading "?". */
export function galleryQuery(params: GalleryParams, page?: number): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.model) query.set("model", params.model);
  if (params.tags.length > 0) query.set("tags", [...params.tags].sort().join(","));
  if (page && page > 1) query.set("page", String(page));
  return query.toString();
}

export function galleryHref(params: GalleryParams, page?: number): string {
  const query = galleryQuery(params, page);
  return query ? `/?${query}` : "/";
}

export function withParams(params: GalleryParams, patch: Partial<GalleryParams>): GalleryParams {
  return { ...params, ...patch };
}

export function toggleTag(params: GalleryParams, slug: string): GalleryParams {
  const tags = params.tags.includes(slug)
    ? params.tags.filter((tag) => tag !== slug)
    : [...params.tags, slug];
  return { ...params, tags: [...tags].sort() };
}
