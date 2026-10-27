"use client";

import { Copy, Eye, ImageOff, Pencil, Send, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";
import { StatusBadge } from "@/features/prompts/components/status-badge";
import { formatDateTime } from "@/shared/format";

export type PromptRow = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  version: number;
  coverAssetId: string | null;
  categoryName: string | null;
  modelName: string | null;
  updatedAt: string;
};

type Outcome = { ok: boolean; message: string };
type BatchAction = "publish" | "unpublish" | "delete";

const actionLabel: Record<BatchAction, string> = {
  publish: "发布",
  unpublish: "撤回",
  delete: "删除",
};

const checkboxClass = "size-4 cursor-pointer rounded border-border-strong accent-[var(--accent)]";

function IconAction({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40",
        tone === "danger" ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-surface-2 hover:text-foreground",
      )}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function PromptTable({ items }: { items: PromptRow[] }) {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [selected, setSelected] = useState<string[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const visibleIds = items.map((item) => item.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  function record(next: Record<string, Outcome>) {
    setOutcomes((current) => ({ ...current, ...next }));
  }

  async function runBatch(action: BatchAction) {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (chosen.length === 0) {
      return;
    }
    if (
      action === "delete" &&
      !(await confirm({
        title: `删除 ${chosen.length} 条内容？`,
        description: "删除后不会出现在后台列表和公开页面中。",
        confirmLabel: "删除",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(`batch:${action}`);
    try {
      const data = await adminFetch<{
        results: Array<{ id: string; ok: boolean; error?: { message: string } }>;
      }>("/api/v1/admin/prompts/batch", csrfToken, {
        method: "POST",
        body: JSON.stringify({
          action,
          items: chosen.map((item) => ({ id: item.id, version: item.version })),
        }),
      });
      const failed = data.results.filter((result) => !result.ok);
      record(
        Object.fromEntries(
          data.results.map((result) => [
            result.id,
            result.ok
              ? { ok: true, message: `已${actionLabel[action]}` }
              : { ok: false, message: result.error?.message ?? "处理失败" },
          ]),
        ),
      );
      setSelected(failed.map((result) => result.id));
      toast(
        failed.length === 0
          ? `已${actionLabel[action]} ${data.results.length} 条`
          : `${data.results.length - failed.length} 条成功，${failed.length} 条失败`,
        failed.length === 0 ? "success" : "error",
      );
      router.refresh();
    } catch (error) {
      toast(errorMessage(error), "error");
    } finally {
      setBusy(null);
    }
  }

  async function runRow(item: PromptRow, action: "publish" | "unpublish" | "duplicate" | "delete") {
    if (
      action === "delete" &&
      !(await confirm({
        title: `删除「${item.title || "未命名草稿"}」？`,
        description: "删除后不会出现在后台列表和公开页面中。",
        confirmLabel: "删除",
        tone: "danger",
      }))
    ) {
      return;
    }
    setBusy(`${item.id}:${action}`);
    try {
      if (action === "duplicate") {
        const created = await adminFetch<{ id: string }>(
          `/api/v1/admin/prompts/${item.id}/duplicate`,
          csrfToken,
          { method: "POST" },
        );
        toast("已复制为新草稿", "success");
        router.push(`/admin/prompts/${created.id}/edit`);
        return;
      }
      await adminFetch(
        action === "delete" ? `/api/v1/admin/prompts/${item.id}` : `/api/v1/admin/prompts/${item.id}/${action}`,
        csrfToken,
        {
          method: action === "delete" ? "DELETE" : "POST",
          body: JSON.stringify({ version: item.version }),
        },
      );
      record({ [item.id]: { ok: true, message: `已${actionLabel[action]}` } });
      toast(`已${actionLabel[action]}「${item.title || "未命名草稿"}」`, "success");
      router.refresh();
    } catch (error) {
      const message = errorMessage(error);
      record({ [item.id]: { ok: false, message } });
      toast(message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3">
      {confirmDialog}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface/50">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border font-mono text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  aria-label="全选本页"
                  checked={allSelected}
                  className={checkboxClass}
                  type="checkbox"
                  onChange={(event) =>
                    setSelected(event.target.checked ? visibleIds : [])
                  }
                />
              </th>
              <th className="px-3 py-3 font-normal">内容</th>
              <th className="px-3 py-3 font-normal">状态</th>
              <th className="hidden px-3 py-3 font-normal md:table-cell">分类 / 模型</th>
              <th className="hidden px-3 py-3 font-normal lg:table-cell">更新时间</th>
              <th className="px-3 py-3 text-right font-normal">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const outcome = outcomes[item.id];
              const isSelected = selected.includes(item.id);
              const rowBusy = busy?.startsWith(`${item.id}:`) ?? false;
              return (
                <tr
                  className={cn("transition-colors", isSelected ? "bg-accent/5" : "hover:bg-surface-2/50")}
                  key={item.id}
                >
                  <td className="px-3 py-2.5">
                    <input
                      aria-label={`选择 ${item.title || "未命名草稿"}`}
                      checked={isSelected}
                      className={checkboxClass}
                      type="checkbox"
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked
                            ? [...current, item.id]
                            : current.filter((id) => id !== item.id),
                        )
                      }
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                        <span className="absolute inset-0 flex items-center justify-center text-muted">
                          <ImageOff aria-hidden="true" className="size-4" />
                        </span>
                        {item.coverAssetId ? (
                          <img
                            alt=""
                            className="relative size-full object-cover"
                            loading="lazy"
                            src={`/api/v1/admin/media/${item.coverAssetId}/card`}
                            onError={(event) => {
                              event.currentTarget.hidden = true;
                            }}
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link
                          className="block truncate font-medium hover:text-accent"
                          href={`/admin/prompts/${item.id}/edit`}
                        >
                          {item.title || <span className="text-muted">未命名草稿</span>}
                        </Link>
                        <p className="truncate font-mono text-[11px] text-muted">/{item.slug}</p>
                        {outcome ? (
                          <p
                            className={cn("mt-0.5 text-xs", outcome.ok ? "text-success" : "text-danger")}
                            role={outcome.ok ? undefined : "alert"}
                          >
                            {outcome.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="hidden px-3 py-2.5 md:table-cell">
                    <p className={item.categoryName ? "" : "text-muted"}>{item.categoryName ?? "未分类"}</p>
                    <p className="font-mono text-[11px] text-muted">{item.modelName ?? "未选模型"}</p>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted lg:table-cell">
                    {formatDateTime(item.updatedAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        aria-label="编辑"
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
                        href={`/admin/prompts/${item.id}/edit`}
                        title="编辑"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Link>
                      <Link
                        aria-label="预览"
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
                        href={`/admin/prompts/${item.id}/preview`}
                        title="预览"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                      </Link>
                      {item.status === "published" ? (
                        <IconAction disabled={rowBusy} label="撤回" onClick={() => runRow(item, "unpublish")}>
                          <Undo2 aria-hidden="true" className="size-4" />
                        </IconAction>
                      ) : (
                        <IconAction disabled={rowBusy} label="发布" onClick={() => runRow(item, "publish")}>
                          <Send aria-hidden="true" className="size-4" />
                        </IconAction>
                      )}
                      <IconAction disabled={rowBusy} label="复制为新草稿" onClick={() => runRow(item, "duplicate")}>
                        <Copy aria-hidden="true" className="size-4" />
                      </IconAction>
                      <IconAction
                        disabled={rowBusy}
                        label="删除"
                        tone="danger"
                        onClick={() => runRow(item, "delete")}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </IconAction>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected.length > 0 ? (
        <div className="fade-in sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-surface-2/95 px-3 py-2 shadow-2xl backdrop-blur">
          <span className="px-2 font-mono text-xs text-muted">
            已选 <span className="text-accent">{selected.length}</span>
          </span>
          <Button
            loading={busy === "batch:publish"}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => runBatch("publish")}
          >
            发布
          </Button>
          <Button
            loading={busy === "batch:unpublish"}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => runBatch("unpublish")}
          >
            撤回
          </Button>
          <Button
            loading={busy === "batch:delete"}
            size="sm"
            type="button"
            variant="danger"
            onClick={() => runBatch("delete")}
          >
            删除
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setSelected([])}>
            取消选择
          </Button>
        </div>
      ) : null}
    </div>
  );
}
