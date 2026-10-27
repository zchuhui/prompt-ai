"use client";

import { useEffect, useState } from "react";
import { adminFetch, useCsrfToken } from "@/features/auth/admin-client";

type Taxonomy = { id: string; name: string };
type AssetItem = {
  assetId: string;
  position: number;
  alt: string | null;
  status: string;
  width: number | null;
  height: number | null;
};
type Prompt = {
  id: string;
  title: string;
  summary: string | null;
  promptText: string;
  negativePrompt: string | null;
  usageNotes: string | null;
  parametersText: string | null;
  modelVersion: string | null;
  aspectRatio: string | null;
  requiresReference: boolean;
  sourceType: "original" | "collected";
  sourceAuthor: string | null;
  sourceUrl: string | null;
  categoryId: string | null;
  modelId: string | null;
  coverAssetId: string | null;
  version: number;
  tagIds: string[];
  assetItems: AssetItem[];
};

export function PromptEditor({
  initial,
  categories,
  models,
  tags,
}: {
  initial: Prompt;
  categories: Taxonomy[];
  models: Array<Taxonomy & { active: boolean }>;
  tags: Taxonomy[];
}) {
  const csrfToken = useCsrfToken();
  const [prompt, setPrompt] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty) {
        return;
      }
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function update<K extends keyof Prompt>(key: K, value: Prompt[K]) {
    setPrompt((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  async function save() {
    const saved = await adminFetch<{ version: number }>(
      `/api/v1/admin/prompts/${prompt.id}`,
      csrfToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          version: prompt.version,
          title: prompt.title,
          summary: prompt.summary,
          promptText: prompt.promptText,
          negativePrompt: prompt.negativePrompt,
          usageNotes: prompt.usageNotes,
          parametersText: prompt.parametersText,
          modelVersion: prompt.modelVersion,
          aspectRatio: prompt.aspectRatio,
          requiresReference: prompt.requiresReference,
          sourceType: prompt.sourceType,
          sourceAuthor: prompt.sourceAuthor,
          sourceUrl: prompt.sourceUrl,
          categoryId: prompt.categoryId,
          modelId: prompt.modelId,
          tagIds: prompt.tagIds,
          coverAssetId: prompt.coverAssetId,
          assetItems: prompt.assetItems.map((item, index) => ({
            assetId: item.assetId,
            position: index,
            alt: item.alt,
          })),
        }),
      },
    );
    setPrompt((current) => ({ ...current, version: saved.version }));
    setDirty(false);
    setMessage("已保存");
    return saved.version;
  }

  async function publish() {
    const version = await save();
    const published = await adminFetch<{ version: number }>(
      `/api/v1/admin/prompts/${prompt.id}/publish`,
      csrfToken,
      { method: "POST", body: JSON.stringify({ version }) },
    );
    setPrompt((current) => ({ ...current, version: published.version }));
    setMessage("已发布");
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save().catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : "保存失败");
        });
      }}
    >
      <label className="grid gap-2 text-sm">
        标题
        <input className="min-h-11 border border-border px-3" value={prompt.title} onChange={(event) => update("title", event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm">
        主 Prompt
        <textarea className="min-h-40 border border-border p-3" value={prompt.promptText} onChange={(event) => update("promptText", event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm">
        简介
        <textarea className="min-h-20 border border-border p-3" value={prompt.summary ?? ""} onChange={(event) => update("summary", event.target.value)} />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm">
          分类
          <select className="min-h-11 border border-border bg-background px-3" value={prompt.categoryId ?? ""} onChange={(event) => update("categoryId", event.target.value || null)}>
            <option value="">未选择</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          模型
          <select className="min-h-11 border border-border bg-background px-3" value={prompt.modelId ?? ""} onChange={(event) => update("modelId", event.target.value || null)}>
            <option value="">未选择</option>
            {models.map((item) => <option key={item.id} value={item.id}>{item.name}{item.active ? "" : "（已停用）"}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend className="text-sm">标签</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {tags.map((tag) => (
            <label className="inline-flex min-h-11 items-center gap-2 text-sm" key={tag.id}>
              <input
                checked={prompt.tagIds.includes(tag.id)}
                type="checkbox"
                onChange={(event) => {
                  update(
                    "tagIds",
                    event.target.checked
                      ? [...prompt.tagIds, tag.id]
                      : prompt.tagIds.filter((id) => id !== tag.id),
                  );
                }}
              />
              {tag.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3">
        {prompt.assetItems.map((item) => (
          <div className="flex flex-wrap items-center gap-3 border border-border p-3" key={item.assetId}>
            {item.status === "ready" ? (
              <img alt={item.alt ?? ""} className="h-20 w-20 object-contain" src={`/api/v1/admin/media/${item.assetId}/card`} />
            ) : (
              <span className="text-sm text-muted">{item.status}</span>
            )}
            <button className="min-h-11 border border-border px-3 text-sm" type="button" onClick={() => update("coverAssetId", item.assetId)}>
              {prompt.coverAssetId === item.assetId ? "当前封面" : "设为封面"}
            </button>
            <button
              className="min-h-11 border border-border px-3 text-sm"
              type="button"
              onClick={() => update("assetItems", prompt.assetItems.filter((image) => image.assetId !== item.assetId))}
            >
              移除
            </button>
          </div>
        ))}
      </div>
      <label className="grid gap-2 text-sm">
        负面提示词
        <textarea className="min-h-20 border border-border p-3" value={prompt.negativePrompt ?? ""} onChange={(event) => update("negativePrompt", event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm">
        使用说明
        <textarea className="min-h-20 border border-border p-3" value={prompt.usageNotes ?? ""} onChange={(event) => update("usageNotes", event.target.value)} />
      </label>
      <label className="grid gap-2 text-sm">
        参数
        <textarea className="min-h-20 border border-border p-3" value={prompt.parametersText ?? ""} onChange={(event) => update("parametersText", event.target.value)} />
      </label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm">
        <input checked={prompt.requiresReference} type="checkbox" onChange={(event) => update("requiresReference", event.target.checked)} />
        需要参考图
      </label>
      <div className="sticky bottom-0 flex flex-wrap gap-2 bg-background py-3">
        <button className="min-h-11 border border-border px-4" type="submit">保存草稿</button>
        <button
          className="min-h-11 bg-accent px-4 text-background"
          type="button"
          onClick={() => {
            void publish().catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : "发布失败");
            });
          }}
        >
          发布
        </button>
        <a className="inline-flex min-h-11 items-center px-3" href={`/admin/prompts/${prompt.id}/preview`}>预览</a>
      </div>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
