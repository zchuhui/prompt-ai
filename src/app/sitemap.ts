import type { MetadataRoute } from "next";
import { listPublicCollections } from "@/features/collections/server/service";
import { listPublishedPrompts } from "@/features/prompts/server/queries";
import { getDatabase } from "@/server/db/client";
import { getEnv } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDatabase();
  const origin = new URL(getEnv().APP_URL).origin;
  const [prompts, collections] = await Promise.all([
    listPublishedPrompts(db),
    listPublicCollections(db),
  ]);
  return [
    { url: origin },
    { url: `${origin}/collections` },
    { url: `${origin}/about` },
    ...prompts.map((prompt) => ({ url: `${origin}/prompts/${prompt.slug}` })),
    ...collections.map((collection) => ({
      url: `${origin}/collections/${collection.slug}`,
    })),
  ];
}
