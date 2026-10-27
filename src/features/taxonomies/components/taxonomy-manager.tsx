"use client";

import { useState } from "react";
import { adminFetch, useCsrfToken } from "@/features/auth/admin-client";

type Row = { id: string; name: string; slug: string; active?: boolean; sortOrder?: number };

export function TaxonomyManager({
  categories,
  tags,
  models,
}: {
  categories: Row[];
  tags: Row[];
  models: Row[];
}) {
  const csrfToken = useCsrfToken();
  const [message, setMessage] = useState<string | null>(null);

  async function create(path: string, name: string) {
    await adminFetch(path, csrfToken, { method: "POST", body: JSON.stringify({ name }) });
    window.location.reload();
  }

  async function remove(path: string) {
    try {
      await adminFetch(path, csrfToken, { method: "DELETE" });
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法删除");
    }
  }

  return (
    <div className="grid gap-10">
      <Section create={(name) => create("/api/v1/admin/categories", name)} remove={(id) => remove(`/api/v1/admin/categories/${id}`)} rows={categories} title="分类" />
      <Section create={(name) => create("/api/v1/admin/tags", name)} remove={(id) => remove(`/api/v1/admin/tags/${id}`)} rows={tags} title="标签" />
      <Section
        create={(name) => create("/api/v1/admin/models", name)}
        extra={(row) => (
          <button
            className="min-h-11 px-3 text-sm"
            type="button"
            onClick={() => {
              void adminFetch(`/api/v1/admin/models/${row.id}`, csrfToken, {
                method: "PATCH",
                body: JSON.stringify({ active: row.active === false }),
              }).then(() => window.location.reload());
            }}
          >
            {row.active === false ? "启用" : "停用"}
          </button>
        )}
        remove={(id) => remove(`/api/v1/admin/models/${id}`)}
        rows={models}
        title="模型"
      />
      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}

function Section({
  title,
  rows,
  create,
  remove,
  extra,
}: {
  title: string;
  rows: Row[];
  create: (name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  extra?: (row: Row) => React.ReactNode;
}) {
  const [name, setName] = useState("");
  return (
    <section>
      <h2 className="text-xl font-medium">{title}</h2>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void create(name);
        }}
      >
        <input className="min-h-11 flex-1 border border-border px-3" value={name} onChange={(event) => setName(event.target.value)} />
        <button className="min-h-11 bg-accent px-4 text-sm text-background" type="submit">新增</button>
      </form>
      <ul className="mt-3 divide-y divide-border border border-border">
        {rows.map((row) => (
          <li className="flex items-center justify-between gap-3 px-3 py-2" key={row.id}>
            <span>{row.name}{row.active === false ? "（已停用）" : ""}</span>
            <span className="flex">
              {extra?.(row)}
              <button className="min-h-11 px-3 text-sm" type="button" onClick={() => void remove(row.id)}>删除</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
