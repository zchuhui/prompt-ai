import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromptEditor } from "@/features/prompts/components/prompt-editor";
import { getAdminPrompt } from "@/features/prompts/server/service";
import { listAdminTaxonomies } from "@/features/taxonomies/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "编辑 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const db = getDatabase();
  const loaded = await Promise.all([
    getAdminPrompt(db, (await params).id),
    listAdminTaxonomies(db),
  ]).catch(() => null);
  if (!loaded) {
    notFound();
  }
  const [prompt, taxonomies] = loaded;
  return (
    <PromptEditor
      categories={taxonomies.categories}
      initial={prompt}
      key={prompt.id}
      models={taxonomies.models}
      tags={taxonomies.tags}
    />
  );
}
