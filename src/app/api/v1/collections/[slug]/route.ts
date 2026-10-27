import { getPublicCollection } from "@/features/collections/server/service";
import { AppError } from "@/shared/errors";
import { parsePage, parsePageSize } from "@/shared/pagination";
import { publicRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const url = new URL(request.url);
  return publicRead(async () => {
    const collection = await getPublicCollection(
      getDatabase(),
      (await context.params).slug,
      parsePage(url.searchParams.get("page") ?? undefined),
      parsePageSize(url.searchParams.get("pageSize") ?? undefined),
    );
    if (!collection) {
      throw new AppError(404, "NOT_FOUND", "合集不存在");
    }
    return collection;
  });
}
