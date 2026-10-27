import { searchPublishedPrompts } from "@/features/prompts/server/queries";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { SEARCH_QUERY_MAX } from "@/shared/constants";
import { publicRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/shared/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  if (q && q.length > SEARCH_QUERY_MAX) {
    return publicRead(async () => {
      throw new AppError(400, "INVALID_INPUT", "搜索词过长");
    });
  }
  return publicRead(() =>
    searchPublishedPrompts(getDatabase(), {
      q: q || undefined,
      categorySlug: url.searchParams.get("category") ?? undefined,
      modelSlug: url.searchParams.get("model") ?? undefined,
      tagSlugs: (url.searchParams.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      page: parsePage(url.searchParams.get("page") ?? undefined),
      pageSize: parsePageSize(url.searchParams.get("pageSize") ?? undefined),
    }),
  );
}
