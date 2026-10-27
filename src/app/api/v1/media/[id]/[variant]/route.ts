import { publicMedia } from "@/features/prompts/server/queries";
import { getDatabase } from "@/server/db/client";
import { requestId, toErrorResponse } from "@/server/http";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; variant: string }> },
) {
  const id = requestId();
  try {
    const params = await context.params;
    const media = await publicMedia(getDatabase(), params.id, params.variant);
    const bytes = await getStorage().get(media.key);
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "image/webp",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return toErrorResponse(error, id);
  }
}
