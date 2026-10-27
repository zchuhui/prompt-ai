"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ExternalLink,
  GripVertical,
  ImageOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { AdminApiError, adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";
import { StatusBadge } from "@/features/prompts/components/status-badge";
import { moveItem } from "@/shared/array";
import { formatDateTime } from "@/shared/format";

const MAX_MEMBERS = 200;

type Member = {
  promptId: string;
  title: string;
  status: "draft" | "published" | "deleted";
  coverAssetId: string | null;
};

export type EditorCollection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  coverAssetId: string | null;
  version: number;
  updatedAt: string;
  members: Member[];
};

type SearchItem = {
  id: string;
  title: string;
  status: "draft" | "published";
  coverAssetId: string | null;
};

type Pending = "save" | "publish" | "unpublish" | "delete" | "reload";

function snapshot(collection: EditorCollection) {
  return JSON.stringify({
    title: collection.title,
    description: collection.description ?? "",
    coverAssetId: collection.coverAssetId,
    promptIds: collection.members.map((member) => member.promptId),
  });
}

function Thumb({ assetId, className }: { assetId: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-2 text-muted",
        className,
      )}
    >
      <ImageOff aria-hidden="true" className="size-4" />
      {assetId ? (
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          draggable={false}
          loading="lazy"
          src={`/api/v1/admin/media/${assetId}/card`}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      ) : null}
    </span>
  );
}

function PromptSearch({
  memberIds,
  disabled,
  onAdd,
}: {
  memberIds: ReadonlySet<string>;
  disabled: boolean;
  onAdd: (item: SearchItem) => void;
}) {
  const csrfToken = useCsrfToken();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: "12" });
      if (query.trim()) {
        params.set("q", query.trim());
      }
      adminFetch<{ items: SearchItem[] }>(`/api/v1/admin/prompts?${params}`, csrfToken, {
        signal: controller.signal,
      })
        .then((data) => {
          setResults(data.items);
          setError(null);
        })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) {
            setError(errorMessage(reason, "搜索失败"));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [csrfToken, query]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          aria-label="按标题搜索内容"
          className="pl-9"
          placeholder="按标题搜索内容"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {loading ? (
          <LoaderCircle
            aria-hidden="true"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted"
          />
        ) : null}
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {results && results.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">没有匹配的内容</p>
      ) : null}
      <ul className="grid max-h-[420px] gap-1 overflow-y-auto pr-1">
        {(results ?? []).map((item) => {
          const added = memberIds.has(item.id);
          return (
            <li className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2/60" key={item.id}>
              <Thumb assetId={item.coverAssetId} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{item.title || "未命名"}</span>
                {item.status === "draft" ? <span className="text-[11px] text-muted">草稿 · 前台不显示</span> : null}
              </span>
              <Button
                aria-label={added ? `${item.title || "未命名"} 已在合集中` : `添加 ${item.title || "未命名"}`}
                disabled={added || disabled}
                size="sm"
                type="button"
                variant={added ? "ghost" : "outline"}
                onClick={() => onAdd(item)}
              >
                {added ? <Check aria-hidden="true" className="size-4" /> : <Plus aria-hidden="true" className="size-4" />}
                {added ? "已添加" : "添加"}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CollectionEditor({ initial }: { initial: EditorCollection }) {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [collection, setCollection] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [conflict, setConflict] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const dirty = snapshot(collection) !== snapshot(saved);
  const busy = pending !== null;
  const memberIds = new Set(collection.members.map((member) => member.promptId));
  const covers = collection.members.filter(
    (member) => member.coverAssetId && member.status === "published",
  );
  const isPublished = saved.status === "published";
  const visibleCount = collection.members.filter((member) => member.status === "published").length;

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function edit(patch: Partial<EditorCollection>) {
    setCollection((current) => ({ ...current, ...patch }));
    setFields({});
  }

  async function fetchLatest() {
    return adminFetch<EditorCollection>(`/api/v1/admin/collections/${collection.id}`, csrfToken);
  }

  function replaceWith(latest: EditorCollection) {
    setCollection(latest);
    setSaved(latest);
    setConflict(false);
    setFields({});
  }

  async function submit(status: "draft" | "published", action: Pending, successText: string) {
    setPending(action);
    try {
      await adminFetch(`/api/v1/admin/collections/${collection.id}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify({
          version: collection.version,
          title: collection.title.trim(),
          description: collection.description?.trim() ? collection.description.trim() : null,
          status,
          coverAssetId: collection.coverAssetId,
          promptIds: collection.members.map((member) => member.promptId),
        }),
      });
      replaceWith(await fetchLatest());
      toast(successText, "success");
      router.refresh();
    } catch (error) {
      if (error instanceof AdminApiError) {
        if (error.status === 409) {
          setConflict(true);
        }
        setFields(error.fields);
      }
      toast(errorMessage(error, "保存失败"), "error");
    } finally {
      setPending(null);
    }
  }

  async function reload() {
    if (
      dirty &&
      !(await confirm({
        title: "放弃未保存的修改？",
        description: "重新加载会用服务器上的最新版本覆盖当前表单。",
        confirmLabel: "重新加载",
        tone: "danger",
      }))
    ) {
      return;
    }
    setPending("reload");
    try {
      replaceWith(await fetchLatest());
      toast("已加载最新版本", "success");
    } catch (error) {
      toast(errorMessage(error, "加载失败"), "error");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "删除这个合集？",
      description: "合集里的内容不会被删除，但合集页面会立即失效。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!ok) {
      return;
    }
    setPending("delete");
    try {
      await adminFetch(`/api/v1/admin/collections/${collection.id}`, csrfToken, { method: "DELETE" });
      setSaved(collection);
      toast("合集已删除", "success");
      router.push("/admin/collections");
      router.refresh();
    } catch (error) {
      toast(errorMessage(error, "删除失败"), "error");
      setPending(null);
    }
  }

  function addMember(item: SearchItem) {
    if (collection.members.length >= MAX_MEMBERS) {
      toast(`一个合集最多 ${MAX_MEMBERS} 条内容`, "error");
      return;
    }
    edit({
      members: [
        ...collection.members,
        { promptId: item.id, title: item.title, status: item.status, coverAssetId: item.coverAssetId },
      ],
    });
  }

  function removeMember(promptId: string) {
    const member = collection.members.find((entry) => entry.promptId === promptId);
    edit({
      members: collection.members.filter((entry) => entry.promptId !== promptId),
      coverAssetId:
        member && member.coverAssetId === collection.coverAssetId ? null : collection.coverAssetId,
    });
  }

  function move(from: number, to: number) {
    edit({ members: moveItem(collection.members, from, to) });
  }

  return (
    <div className="grid gap-6 pb-28">
      {confirmElement}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
            href="/admin/collections"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            返回合集列表
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{saved.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span>/collections/{saved.slug}</span>
            <span aria-hidden="true">·</span>
            <span>v{saved.version}</span>
            <span aria-hidden="true">·</span>
            <span>更新于 {formatDateTime(saved.updatedAt)}</span>
          </p>
        </div>
        <StatusBadge status={saved.status} />
      </div>

      {conflict ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1">这个合集已在别处被修改。重新加载最新版本后再继续编辑，未保存的修改会被覆盖。</p>
          <Button loading={pending === "reload"} size="sm" type="button" variant="outline" onClick={reload}>
            <RefreshCw aria-hidden="true" className="size-3.5" />
            重新加载
          </Button>
        </div>
      ) : null}

      <fieldset className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" disabled={busy}>
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader title="基本信息" />
            <div className="grid gap-5 p-5">
              <Field error={fields.title} label="标题">
                <Input
                  aria-invalid={Boolean(fields.title)}
                  maxLength={120}
                  value={collection.title}
                  onChange={(event) => edit({ title: event.target.value })}
                />
              </Field>
              <Field hint="显示在合集页顶部，可选。" label="简介">
                <Textarea
                  maxLength={2000}
                  value={collection.description ?? ""}
                  onChange={(event) => edit({ description: event.target.value || null })}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              action={
                <Badge tone={collection.members.length > 0 ? "accent" : "neutral"}>
                  {collection.members.length}
                </Badge>
              }
              description={`前台按这个顺序展示；其中 ${visibleCount} 条已发布，草稿和已删除内容不会出现在前台。`}
              title="内容"
            />
            <div className="p-5">
              {fields.promptIds ? (
                <p className="mb-3 text-xs text-danger" role="alert">
                  {fields.promptIds}
                </p>
              ) : null}
              {collection.members.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">
                  还没有内容，从右侧搜索添加
                </p>
              ) : (
                <ol aria-label="合集内容顺序" className="grid gap-1.5">
                  {collection.members.map((member, index) => (
                    <li
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-2 py-1.5",
                        dragIndex === index && "opacity-50",
                      )}
                      draggable
                      key={member.promptId}
                      onDragEnd={() => setDragIndex(null)}
                      onDragOver={(event) => {
                        if (dragIndex !== null) {
                          event.preventDefault();
                        }
                      }}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", member.promptId);
                        setDragIndex(index);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null) {
                          move(dragIndex, index);
                        }
                        setDragIndex(null);
                      }}
                    >
                      <GripVertical aria-hidden="true" className="size-4 shrink-0 cursor-grab text-muted" />
                      <span className="w-6 shrink-0 text-right font-mono text-[11px] text-muted">{index + 1}</span>
                      <Thumb assetId={member.coverAssetId} className="size-10" />
                      <span className="min-w-0 flex-1">
                        <Link
                          className="block truncate text-sm hover:text-accent"
                          href={`/admin/prompts/${member.promptId}/edit`}
                        >
                          {member.title || "未命名"}
                        </Link>
                      </span>
                      {member.status !== "published" ? <StatusBadge status={member.status} /> : null}
                      <span className="flex shrink-0 items-center">
                        <button
                          aria-label="上移"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                          disabled={index === 0}
                          type="button"
                          onClick={() => move(index, index - 1)}
                        >
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          aria-label="下移"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                          disabled={index === collection.members.length - 1}
                          type="button"
                          onClick={() => move(index, index + 1)}
                        >
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          aria-label={`从合集移除 ${member.title || "未命名"}`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-danger/10 hover:text-danger"
                          type="button"
                          onClick={() => removeMember(member.promptId)}
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>

        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader description="草稿也可以加入，发布后才会在前台出现。" title="添加内容" />
            <div className="p-5">
              <PromptSearch disabled={busy} memberIds={memberIds} onAdd={addMember} />
            </div>
          </Card>

          <Card>
            <CardHeader description="从已发布成员的封面里挑一张；不选时前台用前几条内容拼贴。" title="合集封面" />
            <div className="p-5">
              {covers.length === 0 ? (
                <p className="text-sm text-muted">添加已发布且带图片的内容后可以选择封面。</p>
              ) : (
                <div aria-label="合集封面" className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup">
                  <button
                    aria-checked={collection.coverAssetId === null}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border text-xs transition-colors",
                      collection.coverAssetId === null
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border-strong text-muted hover:border-accent/40",
                    )}
                    role="radio"
                    type="button"
                    onClick={() => edit({ coverAssetId: null })}
                  >
                    自动拼贴
                  </button>
                  {covers.map((member) => {
                    const selected = member.coverAssetId === collection.coverAssetId;
                    return (
                      <button
                        aria-checked={selected}
                        aria-label={`用「${member.title || "未命名"}」的封面`}
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                          selected ? "border-accent" : "border-transparent hover:border-accent/40",
                        )}
                        key={member.promptId}
                        role="radio"
                        type="button"
                        onClick={() => edit({ coverAssetId: member.coverAssetId })}
                      >
                        <Thumb assetId={member.coverAssetId} className="absolute inset-0 size-full rounded-none border-0" />
                        {selected ? (
                          <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                            <Check aria-hidden="true" className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </fieldset>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 backdrop-blur-md lg:left-60">
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-3 sm:gap-3 sm:px-6 lg:px-8">
          <p aria-live="polite" className="flex min-w-0 items-center gap-2 text-xs text-muted">
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", dirty ? "bg-warning" : "bg-success")}
            />
            <span className="sr-only sm:not-sr-only">
              {dirty ? "有未保存的修改" : `已保存 · v${saved.version}`}
            </span>
          </p>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {isPublished ? (
              <Button asChild className="px-2 sm:px-3" size="sm" variant="ghost">
                <Link href={`/collections/${saved.slug}`} target="_blank">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="hidden sm:inline">前台</span>
                </Link>
              </Button>
            ) : null}
            <Button
              aria-label="删除合集"
              className="px-2 text-danger hover:bg-danger/10 hover:text-danger sm:px-3"
              disabled={busy}
              loading={pending === "delete"}
              size="sm"
              title="删除合集"
              type="button"
              variant="ghost"
              onClick={remove}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border sm:block" />
            {isPublished ? (
              <Button
                disabled={busy}
                loading={pending === "unpublish"}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => submit("draft", "unpublish", "合集已下线")}
              >
                <Undo2 aria-hidden="true" className="size-4" />
                下线
              </Button>
            ) : null}
            <Button
              disabled={busy || !dirty}
              loading={pending === "save"}
              size="sm"
              type="button"
              variant={isPublished ? "default" : "outline"}
              onClick={() => submit(saved.status, "save", "已保存")}
            >
              <Save aria-hidden="true" className="size-4" />
              {isPublished ? "保存更新" : "保存草稿"}
            </Button>
            {isPublished ? null : (
              <Button
                disabled={busy}
                loading={pending === "publish"}
                size="sm"
                type="button"
                onClick={() => submit("published", "publish", "合集已发布")}
              >
                <Send aria-hidden="true" className="size-4" />
                发布
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
