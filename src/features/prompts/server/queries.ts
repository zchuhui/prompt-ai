import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { prompts } from "@/server/db/schema";

export async function listPublishedPrompts(db: Database) {
  return db
    .select({
      id: prompts.id,
      slug: prompts.slug,
      title: prompts.title,
      summary: prompts.summary,
      publishedAt: prompts.publishedAt,
    })
    .from(prompts)
    .where(and(eq(prompts.status, "published"), isNull(prompts.deletedAt)))
    .orderBy(desc(prompts.publishedAt), desc(prompts.id));
}
