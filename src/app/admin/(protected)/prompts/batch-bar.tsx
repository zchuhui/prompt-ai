"use client";

import Link from "next/link";
import { useState } from "react";
import { adminFetch, useCsrfToken } from "@/features/auth/admin-client";

type Item = {
  id: string;
  title: string;
  status: "draft" | "published";
  version: number;
  categoryName: string | null;
  modelName: string | null;
  updatedAt: string;
};

export function PromptBatchBar({ items }: { items: Item[] }) {
  const csrfToken = useCsrfToken();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "publish" | "unpublish" | "delete") {
    if (selected.length === 0) {
      return;
    }
    if (action === "delete" && !window.confirm(`删除 ${selected.length} 条内容？`)) {
      return;
    }
    const chosen = items.filter((item) => selected.includes(item.id));
    const data = await adminFetch<{ results: Array<{ id: string; ok: boolean; error?: { message: string } }> }>(
      "/api/v1/admin/prompts/batch",
      csrfToken,
      {
        method: "POST",
        body: JSON.stringify({
          action,
          items: chosen.map((item) => ({ id: item.id, version: item.version })),
        }),
      },
    );
    const failed = data.results.filter((result) => !result.ok);
    setMessage(failed.length === 0 ? "已处理" : failed.map((result) => result.error?.message).join("；"));
    window.location.reload();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2">
        <button className="min-h-11 border border-border px-3 text-sm" type="button" onClick={() => run("publish")}>批量发布</button>
        <button className="min-h-11 border border-border px-3 text-sm" type="button" onClick={() => run("unpublish")}>批量撤回</button>
        <button className="min-h-11 border border-border px-3 text-sm" type="button" onClick={() => run("delete")}>批量删除</button>
        {message ? <p className="text-sm text-muted">{message}</p> : null}
      </div>
      <ul className="mt-4 divide-y divide-border border border-border">
        {items.map((item) => (
          <li className="flex flex-wrap items-center gap-3 px-3 py-3" key={item.id}>
            <input
              checked={selected.includes(item.id)}
              className="h-5 w-5"
              type="checkbox"
              onChange={(event) => {
                setSelected((current) =>
                  event.target.checked
                    ? [...current, item.id]
                    : current.filter((id) => id !== item.id),
                );
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.title || "未命名草稿"}</p>
              <p className="text-sm text-muted">
                {item.status === "published" ? "已发布" : "草稿"} · {item.categoryName ?? "未分类"} · {item.modelName ?? "未选模型"}
              </p>
            </div>
            <Link className="min-h-11 inline-flex items-center" href={`/admin/prompts/${item.id}/edit`}>编辑</Link>
            <Link className="min-h-11 inline-flex items-center" href={`/admin/prompts/${item.id}/preview`}>预览</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
