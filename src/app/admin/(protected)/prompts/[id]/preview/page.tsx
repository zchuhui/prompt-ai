import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminPrompt } from "@/features/prompts/server/service";
import { getDatabase } from "@/server/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "预览 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const prompt = await getAdminPrompt(getDatabase(), (await params).id).catch(() => null);
  if (!prompt) {
    notFound();
  }
  return (
    <article>
      <p className="text-sm text-accent">预览 · {prompt.status === "published" ? "已发布" : "草稿"}</p>
      <h1 className="mt-3 text-3xl font-semibold">{prompt.title || "未命名"}</h1>
      <pre className="mt-6 whitespace-pre-wrap border border-border p-4">{prompt.promptText}</pre>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {prompt.assetItems.map((item) => (
          <img
            alt={item.alt ?? ""}
            height={item.height ?? 1}
            key={item.assetId}
            src={`/api/v1/admin/media/${item.assetId}/detail`}
            width={item.width ?? 1}
          />
        ))}
      </div>
    </article>
  );
}
