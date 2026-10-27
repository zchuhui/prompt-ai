import { getPublishedPrompt } from "@/features/prompts/server/queries";
import { listRelatedPrompts } from "@/features/prompts/server/service";
import { AppError } from "@/shared/errors";
import { publicRead } from "@/server/api";
import { getDatabase } from "@/server/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  return publicRead(async () => {
    const slug = (await context.params).slug;
    const db = getDatabase();
    const prompt = await getPublishedPrompt(db, slug);
    if (!prompt) {
      throw new AppError(404, "NOT_FOUND", "内容不存在");
    }
    return { ...prompt, related: await listRelatedPrompts(db, prompt.id) };
  });
}
