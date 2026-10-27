import { adminRead, adminWrite } from "@/server/api";
import { getDatabase } from "@/server/db/client";
import { requestHash, withIdempotency } from "@/server/idempotency";
import { createEmptyPrompt, listAdminPrompts } from "@/features/prompts/server/service";
import { parsePage, parsePageSize } from "@/shared/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status =
    statusParam === "draft" || statusParam === "published" ? statusParam : undefined;
  return adminRead(request, async () =>
    listAdminPrompts(getDatabase(), {
      q: url.searchParams.get("q") ?? undefined,
      status,
      categoryId: url.searchParams.get("categoryId") ?? undefined,
      modelId: url.searchParams.get("modelId") ?? undefined,
      page: parsePage(url.searchParams.get("page") ?? undefined),
      pageSize: parsePageSize(url.searchParams.get("pageSize") ?? undefined),
    }),
  );
}

export function POST(request: Request) {
  return adminWrite(request, async (admin, id) => {
    const rawBody = await request.text();
    return withIdempotency(
      getDatabase(),
      {
        adminId: admin.adminId,
        key: request.headers.get("idempotency-key"),
        hash: requestHash("/api/v1/admin/prompts", rawBody),
      },
      () =>
        createEmptyPrompt(getDatabase(), {
          adminId: admin.adminId,
          requestId: id,
        }),
    );
  });
}
