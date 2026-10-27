"use client";

import { Plus, Power, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";

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
  const router = useRouter();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, action: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await action();
      toast(success, "success");
      router.refresh();
      return true;
    } catch (error) {
      toast(errorMessage(error), "error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const sections = [
    { key: "categories", title: "分类", description: "每条内容属于一个分类，用于前台筛选。", rows: categories },
    { key: "tags", title: "标签", description: "可多选，用于前台标签筛选和相关推荐。", rows: tags },
    { key: "models", title: "模型", description: "停用后不再出现在编辑器选项里，已有内容不受影响。", rows: models },
  ] as const;

  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {confirmDialog}
      {sections.map((section) => (
        <Section
          busy={busy}
          create={(name) =>
            run(
              `${section.key}:create`,
              () =>
                adminFetch(`/api/v1/admin/${section.key}`, csrfToken, {
                  method: "POST",
                  body: JSON.stringify({ name }),
                }),
              `已新增「${name}」`,
            )
          }
          description={section.description}
          extra={
            section.key === "models"
              ? (row) => (
                  <button
                    aria-label={row.active === false ? `启用 ${row.name}` : `停用 ${row.name}`}
                    className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
                    disabled={busy !== null}
                    title={row.active === false ? "启用" : "停用"}
                    type="button"
                    onClick={() =>
                      void run(
                        `models:${row.id}`,
                        () =>
                          adminFetch(`/api/v1/admin/models/${row.id}`, csrfToken, {
                            method: "PATCH",
                            body: JSON.stringify({ active: row.active === false }),
                          }),
                        row.active === false ? `已启用「${row.name}」` : `已停用「${row.name}」`,
                      )
                    }
                  >
                    <Power aria-hidden="true" className="size-4" />
                  </button>
                )
              : undefined
          }
          key={section.key}
          remove={async (row) => {
            if (
              await confirm({
                title: `删除${section.title}「${row.name}」？`,
                description: "仍被内容使用时无法删除。",
                confirmLabel: "删除",
                tone: "danger",
              })
            ) {
              await run(
                `${section.key}:${row.id}`,
                () => adminFetch(`/api/v1/admin/${section.key}/${row.id}`, csrfToken, { method: "DELETE" }),
                `已删除「${row.name}」`,
              );
            }
          }}
          rows={section.rows}
          sectionKey={section.key}
          title={section.title}
        />
      ))}
    </div>
  );
}

function Section({
  sectionKey,
  title,
  description,
  rows,
  busy,
  create,
  remove,
  extra,
}: {
  sectionKey: string;
  title: string;
  description: string;
  rows: Row[];
  busy: string | null;
  create: (name: string) => Promise<boolean>;
  remove: (row: Row) => Promise<void>;
  extra?: (row: Row) => React.ReactNode;
}) {
  const [name, setName] = useState("");
  return (
    <Card className="flex flex-col">
      <CardHeader
        action={<Badge>{rows.length}</Badge>}
        description={description}
        title={title}
      />
      <form
        className="flex gap-2 border-b border-border px-5 py-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const value = name.trim();
          if (value && (await create(value))) {
            setName("");
          }
        }}
      >
        <Input
          aria-label={`新${title}名称`}
          className="min-h-10"
          maxLength={60}
          placeholder={`新${title}名称`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          className="min-h-10"
          disabled={!name.trim()}
          loading={busy === `${sectionKey}:create`}
          type="submit"
        >
          {busy === `${sectionKey}:create` ? null : <Plus aria-hidden="true" className="size-4" />}
          新增
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">还没有{title}</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
          {rows.map((row) => (
            <li className="flex items-center justify-between gap-3 px-5 py-2" key={row.id}>
              <div className="min-w-0">
                <p className={row.active === false ? "text-muted line-through" : ""}>{row.name}</p>
                <p className="truncate font-mono text-[11px] text-muted">{row.slug}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {row.active === false ? <Badge tone="warning">停用</Badge> : null}
                {extra?.(row)}
                <button
                  aria-label={`删除 ${row.name}`}
                  className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                  disabled={busy !== null}
                  title="删除"
                  type="button"
                  onClick={() => void remove(row)}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
