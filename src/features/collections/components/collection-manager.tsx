"use client";

import { useState } from "react";
import { adminFetch, useCsrfToken } from "@/features/auth/admin-client";

type Collection = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  version: number;
  slug: string;
};

export function CollectionManager({
  collections,
  prompts,
}: {
  collections: Collection[];
  prompts: Array<{ id: string; title: string }>;
}) {
  const csrfToken = useCsrfToken();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function create() {
    await adminFetch("/api/v1/admin/collections", csrfToken, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    window.location.reload();
  }

  async function save(collection: Collection, promptIds: string[], status: "draft" | "published") {
    try {
      await adminFetch(`/api/v1/admin/collections/${collection.id}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify({
          version: collection.version,
          title: collection.title,
          status,
          promptIds,
        }),
      });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    }
  }

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input className="min-h-11 flex-1 border border-border px-3" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="新合集标题" />
        <button className="min-h-11 bg-accent px-4 text-sm text-background" type="submit">新建</button>
      </form>
      <ul className="mt-6 flex flex-col gap-4">
        {collections.map((collection) => (
          <CollectionEditor
            collection={collection}
            key={collection.id}
            prompts={prompts}
            onSave={save}
          />
        ))}
      </ul>
      {message ? <p className="mt-4 text-sm">{message}</p> : null}
    </div>
  );
}

function CollectionEditor({
  collection,
  prompts,
  onSave,
}: {
  collection: Collection;
  prompts: Array<{ id: string; title: string }>;
  onSave: (collection: Collection, promptIds: string[], status: "draft" | "published") => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <li className="border border-border p-4">
      <p className="font-medium">{collection.title}</p>
      <p className="text-sm text-muted">{collection.status === "published" ? "已发布" : "草稿"}</p>
      <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-auto">
        {prompts.map((prompt) => (
          <label className="flex min-h-11 items-center gap-2 text-sm" key={prompt.id}>
            <input
              type="checkbox"
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked
                    ? [...current, prompt.id]
                    : current.filter((id) => id !== prompt.id),
                );
              }}
            />
            {prompt.title || "未命名"}
          </label>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button className="min-h-11 border border-border px-3 text-sm" type="button" onClick={() => void onSave(collection, selected, "draft")}>保存草稿</button>
        <button className="min-h-11 bg-accent px-3 text-sm text-background" type="button" onClick={() => void onSave(collection, selected, "published")}>发布合集</button>
      </div>
    </li>
  );
}
