"use client";

import {
  ArrowLeft,
  Copy,
  Eye,
  ExternalLink,
  RefreshCw,
  Save,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { AdminApiError, adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";
import { UploadQueue } from "@/features/uploads/components/upload-queue";
import { formatDateTime } from "@/shared/format";
import { moveItem } from "@/shared/array";
import { createSlug, isValidSlug } from "@/shared/slug";
import { mergeServerAssets, toPatch, type EditorPrompt } from "../editor-state";
import { EditorImages } from "./editor-images";
import { StatusBadge } from "./status-badge";

type Taxonomy = { id: string; name: string };
type Pending = "save" | "publish" | "unpublish" | "duplicate" | "delete" | "reload";

const MAX_IMAGES = 20;
const MAX_TAGS = 20;
const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "2:3", "3:2", "9:16", "16:9", "21:9"];

const nullable = (value: string) => (value === "" ? null : value);

function Counter({ value, max }: { value: string | null; max: number }) {
  const length = value?.length ?? 0;
  return (
    <span className={cn("font-mono text-[11px]", length > max ? "text-danger" : "text-muted")}>
      {length}/{max}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader description={description} title={title} />
      <div className="grid gap-5 p-5">{children}</div>
    </Card>
  );
}

export function PromptEditor({
  initial,
  categories,
  models,
  tags,
}: {
  initial: EditorPrompt;
  categories: Taxonomy[];
  models: Array<Taxonomy & { active: boolean }>;
  tags: Taxonomy[];
}) {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const toast = useToast();
  const [confirm, confirmElement] = useConfirm();
  const [prompt, setPrompt] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [conflict, setConflict] = useState(false);

  const slugEditable = saved.publishedAt === null;
  const slugChanged = prompt.slug !== saved.slug;
  const dirty =
    JSON.stringify(toPatch(prompt, slugEditable)) !== JSON.stringify(toPatch(saved, slugEditable));
  const busy = pending !== null;
  const slugError =
    fields.slug ?? (slugChanged && !isValidSlug(prompt.slug) ? "3 到 80 个字符，只能包含小写字母、数字和连字符" : undefined);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function update<K extends keyof EditorPrompt>(key: K, value: EditorPrompt[K]) {
    setPrompt((current) => ({ ...current, [key]: value }));
    if (fields[key as string]) {
      setFields((current) => {
        const next = { ...current };
        delete next[key as string];
        return next;
      });
    }
  }

  async function fetchLatest(): Promise<EditorPrompt> {
    return adminFetch<EditorPrompt>(`/api/v1/admin/prompts/${prompt.id}`, csrfToken);
  }

  function replaceWith(latest: EditorPrompt) {
    setPrompt(latest);
    setSaved(latest);
    setRemoved(new Set());
    setConflict(false);
  }

  function fail(error: unknown, fallback: string) {
    if (error instanceof AdminApiError) {
      if (error.status === 409 && error.code !== "SLUG_CONFLICT") {
        setConflict(true);
      }
      if (error.code === "SLUG_CONFLICT") {
        setFields((current) => ({ ...current, slug: "这个链接已被其他内容使用" }));
      }
      if (Object.keys(error.fields).length > 0) {
        setFields(error.fields);
      }
    }
    toast(errorMessage(error, fallback), "error");
  }

  async function persist(): Promise<EditorPrompt | null> {
    if (slugChanged && !isValidSlug(prompt.slug)) {
      toast("请先修正链接格式", "error");
      return null;
    }
    try {
      await adminFetch(`/api/v1/admin/prompts/${prompt.id}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify(toPatch(prompt, slugEditable && slugChanged)),
      });
      const latest = await fetchLatest();
      replaceWith(latest);
      setFields({});
      return latest;
    } catch (error) {
      fail(error, "保存失败");
      return null;
    }
  }

  async function save() {
    if (busy || !dirty) {
      return;
    }
    setPending("save");
    const latest = await persist();
    setPending(null);
    if (latest) {
      toast("已保存", "success");
      router.refresh();
    }
  }

  async function changeStatus(action: "publish" | "unpublish") {
    setPending(action);
    try {
      let version = prompt.version;
      if (dirty) {
        const latest = await persist();
        if (!latest) {
          return;
        }
        version = latest.version;
      }
      await adminFetch(`/api/v1/admin/prompts/${prompt.id}/${action}`, csrfToken, {
        method: "POST",
        body: JSON.stringify({ version }),
      });
      replaceWith(await fetchLatest());
      setFields({});
      toast(action === "publish" ? "已发布" : "已下线", "success");
      router.refresh();
    } catch (error) {
      fail(error, action === "publish" ? "发布失败" : "下线失败");
    } finally {
      setPending(null);
    }
  }

  async function reload() {
    if (dirty && !(await confirm({ title: "放弃未保存的修改？", description: "重新加载会用服务器上的最新版本覆盖当前表单。", confirmLabel: "重新加载", tone: "danger" }))) {
      return;
    }
    setPending("reload");
    try {
      replaceWith(await fetchLatest());
      setFields({});
      toast("已加载最新版本", "success");
    } catch (error) {
      toast(errorMessage(error, "加载失败"), "error");
    } finally {
      setPending(null);
    }
  }

  async function syncUploads() {
    try {
      const latest = await fetchLatest();
      setSaved((current) => mergeServerAssets(current, latest, new Set()));
      setPrompt((current) => mergeServerAssets(current, latest, removed));
    } catch (error) {
      toast(errorMessage(error, "无法刷新图片"), "error");
    }
  }

  async function duplicate() {
    if (dirty && !(await confirm({ title: "复制已保存的版本？", description: "未保存的修改不会被复制。", confirmLabel: "继续复制" }))) {
      return;
    }
    setPending("duplicate");
    try {
      const created = await adminFetch<{ id: string }>(`/api/v1/admin/prompts/${prompt.id}/duplicate`, csrfToken, {
        method: "POST",
        body: "{}",
      });
      toast("已复制为新草稿", "success");
      router.push(`/admin/prompts/${created.id}/edit`);
    } catch (error) {
      fail(error, "复制失败");
      setPending(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "删除这条内容？",
      description: prompt.status === "published" ? "它会立即从前台下线，且无法在后台恢复。" : "删除后无法在后台恢复。",
      confirmLabel: "删除",
      tone: "danger",
    });
    if (!ok) {
      return;
    }
    setPending("delete");
    try {
      await adminFetch(`/api/v1/admin/prompts/${prompt.id}`, csrfToken, {
        method: "DELETE",
        body: JSON.stringify({ version: saved.version }),
      });
      setSaved(prompt);
      toast("已删除", "success");
      router.push("/admin/prompts");
      router.refresh();
    } catch (error) {
      fail(error, "删除失败");
      setPending(null);
    }
  }

  function moveImage(from: number, to: number) {
    setPrompt((current) => ({ ...current, assetItems: moveItem(current.assetItems, from, to) }));
  }

  function removeImage(assetId: string) {
    setRemoved((current) => new Set([...current, assetId]));
    setPrompt((current) => {
      const assetItems = current.assetItems.filter((item) => item.assetId !== assetId);
      const coverAssetId =
        current.coverAssetId === assetId
          ? (assetItems.find((item) => item.status === "ready")?.assetId ?? null)
          : current.coverAssetId;
      return { ...current, assetItems, coverAssetId };
    });
  }

  function toggleTag(tagId: string) {
    const selected = prompt.tagIds.includes(tagId);
    if (!selected && prompt.tagIds.length >= MAX_TAGS) {
      toast(`最多选择 ${MAX_TAGS} 个标签`, "error");
      return;
    }
    update("tagIds", selected ? prompt.tagIds.filter((id) => id !== tagId) : [...prompt.tagIds, tagId]);
  }

  const isPublished = prompt.status === "published";
  const imageSlots = Math.max(0, MAX_IMAGES - prompt.assetItems.length);
  const selectedModel = models.find((model) => model.id === prompt.modelId);
  const unknownFields = Object.entries(fields).filter(
    ([key]) => !(key in prompt) && key !== "assetItems" && key !== "coverAssetId",
  );

  return (
    <form
      className="pb-28"
      noValidate
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void save();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {confirmElement}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
            href="/admin/prompts"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            返回内容列表
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight">{saved.title || "未命名草稿"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted">
            <span>/prompts/{saved.slug}</span>
            <span aria-hidden="true">·</span>
            <span>v{saved.version}</span>
            <span aria-hidden="true">·</span>
            <span>更新于 {formatDateTime(saved.updatedAt)}</span>
          </p>
        </div>
        <StatusBadge status={prompt.status} />
      </div>

      {conflict ? (
        <div
          className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
          role="alert"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
          <p className="min-w-0 flex-1">这条内容已在别处被修改。重新加载最新版本后再继续编辑，未保存的修改会被覆盖。</p>
          <Button loading={pending === "reload"} size="sm" type="button" variant="outline" onClick={reload}>
            <RefreshCw aria-hidden="true" className="size-3.5" />
            重新加载
          </Button>
        </div>
      ) : null}

      {unknownFields.length > 0 ? (
        <ul className="mt-5 grid gap-1 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {unknownFields.map(([key, text]) => (
            <li key={key}>{text}</li>
          ))}
        </ul>
      ) : null}

      <fieldset className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" disabled={busy}>
        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader
              action={
                <Badge tone={prompt.assetItems.length > 0 ? "accent" : "neutral"}>
                  {prompt.assetItems.length}/{MAX_IMAGES}
                </Badge>
              }
              description="拖动或用箭头调整顺序；第一张不一定是封面，封面单独指定。"
              title="图片"
            />
            <div className="grid gap-4 p-5">
              <EditorImages
                coverAssetId={prompt.coverAssetId}
                error={fields.assetItems ?? fields.coverAssetId}
                items={prompt.assetItems}
                onAlt={(assetId, alt) =>
                  setPrompt((current) => ({
                    ...current,
                    assetItems: current.assetItems.map((item) =>
                      item.assetId === assetId ? { ...item, alt } : item,
                    ),
                  }))
                }
                onCover={(assetId) => update("coverAssetId", assetId)}
                onMove={moveImage}
                onRemove={removeImage}
              />
              <UploadQueue
                compact
                disabled={dirty || busy || imageSlots === 0}
                disabledReason={
                  imageSlots === 0
                    ? `已达到 ${MAX_IMAGES} 张上限`
                    : dirty
                      ? "先保存当前修改，再上传图片"
                      : undefined
                }
                maxItems={imageSlots}
                mode="single"
                targetPromptId={prompt.id}
                onItemReady={() => void syncUploads()}
                onSettled={() => void syncUploads()}
              />
            </div>
          </Card>
        </div>

        <div className="grid min-w-0 gap-6">
          <Section title="基本信息">
            <Field error={fields.title} label="标题">
              <Input
                aria-invalid={Boolean(fields.title)}
                maxLength={120}
                placeholder="一句话说明画面"
                value={prompt.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </Field>
            <div className="grid gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <label className="font-medium text-foreground/90" htmlFor="prompt-slug">
                  链接
                </label>
                {slugEditable ? (
                  <button
                    className="inline-flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-40"
                    disabled={!prompt.title.trim()}
                    type="button"
                    onClick={() => update("slug", createSlug(prompt.title))}
                  >
                    <Wand2 aria-hidden="true" className="size-3.5" />
                    从标题生成
                  </button>
                ) : null}
              </div>
              <div className="flex items-stretch overflow-hidden rounded-lg border border-border-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
                <span className="flex items-center border-r border-border bg-surface-2 px-3 font-mono text-xs text-muted">
                  /prompts/
                </span>
                <input
                  aria-describedby="prompt-slug-hint"
                  aria-invalid={Boolean(slugError)}
                  className="min-h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-sm focus:outline-none disabled:text-muted"
                  disabled={!slugEditable}
                  id="prompt-slug"
                  maxLength={80}
                  value={prompt.slug}
                  onChange={(event) => update("slug", event.target.value.toLowerCase())}
                />
              </div>
              <span className={cn("text-xs", slugError ? "text-danger" : "text-muted")} id="prompt-slug-hint">
                {slugError ??
                  (slugEditable ? "首次发布后链接固定，不能再修改。" : "已发布过的内容链接固定，避免外链失效。")}
              </span>
            </div>
            <Field error={fields.summary} label="简介">
              <Textarea
                className="min-h-20"
                maxLength={500}
                placeholder="可选。卡片和分享时显示，留空则截取 Prompt。"
                value={prompt.summary ?? ""}
                onChange={(event) => update("summary", nullable(event.target.value))}
              />
            </Field>
          </Section>

          <Section description="主 Prompt 必填，其余按需填写。" title="提示词">
            <div className="grid gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <label className="font-medium text-foreground/90" htmlFor="prompt-text">
                  主 Prompt
                </label>
                <Counter max={50000} value={prompt.promptText} />
              </div>
              <Textarea
                aria-invalid={Boolean(fields.promptText)}
                className="min-h-52 font-mono text-[13px]"
                id="prompt-text"
                spellCheck={false}
                value={prompt.promptText}
                onChange={(event) => update("promptText", event.target.value)}
              />
              {fields.promptText ? (
                <span className="text-xs text-danger" role="alert">
                  {fields.promptText}
                </span>
              ) : null}
            </div>
            <Field error={fields.negativePrompt} label="负面提示词">
              <Textarea
                className="font-mono text-[13px]"
                spellCheck={false}
                value={prompt.negativePrompt ?? ""}
                onChange={(event) => update("negativePrompt", nullable(event.target.value))}
              />
            </Field>
            <Field error={fields.parametersText} hint="例如 --ar 3:4 --stylize 250" label="参数">
              <Textarea
                className="min-h-16 font-mono text-[13px]"
                spellCheck={false}
                value={prompt.parametersText ?? ""}
                onChange={(event) => update("parametersText", nullable(event.target.value))}
              />
            </Field>
            <Field error={fields.usageNotes} label="使用说明">
              <Textarea
                value={prompt.usageNotes ?? ""}
                onChange={(event) => update("usageNotes", nullable(event.target.value))}
              />
            </Field>
          </Section>

          <Section title="分类与模型">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field error={fields.categoryId} label="分类">
                <Select
                  aria-invalid={Boolean(fields.categoryId)}
                  value={prompt.categoryId ?? ""}
                  onChange={(event) => update("categoryId", nullable(event.target.value))}
                >
                  <option value="">未选择</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                error={fields.modelId}
                hint={selectedModel && !selectedModel.active ? "该模型已停用，新发布需要换成启用中的模型" : undefined}
                label="模型"
              >
                <Select
                  aria-invalid={Boolean(fields.modelId)}
                  value={prompt.modelId ?? ""}
                  onChange={(event) => update("modelId", nullable(event.target.value))}
                >
                  <option value="">未选择</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.active ? model.name : `${model.name}（已停用）`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field error={fields.modelVersion} label="模型版本">
                <Input
                  maxLength={120}
                  placeholder="例如 v7"
                  value={prompt.modelVersion ?? ""}
                  onChange={(event) => update("modelVersion", nullable(event.target.value))}
                />
              </Field>
              <Field error={fields.aspectRatio} label="画面比例">
                <Input
                  list="aspect-ratio-options"
                  maxLength={32}
                  placeholder="例如 3:4"
                  value={prompt.aspectRatio ?? ""}
                  onChange={(event) => update("aspectRatio", nullable(event.target.value))}
                />
                <datalist id="aspect-ratio-options">
                  {ASPECT_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio} />
                  ))}
                </datalist>
              </Field>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-2/40 px-3 py-3 text-sm">
              <input
                checked={prompt.requiresReference}
                className="mt-0.5 size-4 accent-[var(--color-accent)]"
                type="checkbox"
                onChange={(event) => update("requiresReference", event.target.checked)}
              />
              <span>
                <span className="font-medium">需要参考图</span>
                <span className="mt-0.5 block text-xs text-muted">
                  这条 Prompt 依赖垫图或角色参考，前台会提示访客。
                </span>
              </span>
            </label>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground/90">标签</span>
                <span className="font-mono text-[11px] text-muted">
                  {prompt.tagIds.length}/{MAX_TAGS}
                </span>
              </div>
              {tags.length === 0 ? (
                <p className="text-xs text-muted">
                  还没有标签，去
                  <Link className="text-accent hover:underline" href="/admin/taxonomies">
                    分类管理
                  </Link>
                  添加。
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = prompt.tagIds.includes(tag.id);
                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "min-h-8 rounded-full border px-3 text-xs transition-colors",
                          selected
                            ? "border-accent/50 bg-accent/15 text-accent"
                            : "border-border-strong text-muted hover:border-accent/40 hover:text-foreground",
                        )}
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {fields.tagIds ? <span className="text-xs text-danger">{fields.tagIds}</span> : null}
            </div>
          </Section>

          <Section title="来源">
            <div aria-label="来源类型" className="grid grid-cols-2 gap-2" role="radiogroup">
              {(
                [
                  ["original", "原创", "自己写的 Prompt"],
                  ["collected", "收集", "转载或整理自他人"],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  className={cn(
                    "cursor-pointer rounded-lg border px-3 py-2.5 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent/40",
                    prompt.sourceType === value
                      ? "border-accent/50 bg-accent/10"
                      : "border-border-strong hover:border-accent/30",
                  )}
                  key={value}
                >
                  <input
                    checked={prompt.sourceType === value}
                    className="sr-only"
                    name="sourceType"
                    type="radio"
                    value={value}
                    onChange={() => update("sourceType", value)}
                  />
                  <span className="font-medium">{label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field error={fields.sourceAuthor} label="作者">
                <Input
                  maxLength={120}
                  value={prompt.sourceAuthor ?? ""}
                  onChange={(event) => update("sourceAuthor", nullable(event.target.value))}
                />
              </Field>
              <Field error={fields.sourceUrl} label="来源链接">
                <Input
                  aria-invalid={Boolean(fields.sourceUrl)}
                  inputMode="url"
                  placeholder="https://"
                  type="url"
                  value={prompt.sourceUrl ?? ""}
                  onChange={(event) => update("sourceUrl", nullable(event.target.value))}
                />
              </Field>
            </div>
          </Section>
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
            <Button asChild className="px-2 sm:px-3" size="sm" variant="ghost">
              <Link href={`/admin/prompts/${prompt.id}/preview`} target="_blank">
                <Eye aria-hidden="true" className="size-4" />
                <span className="sr-only sm:not-sr-only">预览</span>
              </Link>
            </Button>
            {isPublished ? (
              <Button asChild className="px-2 sm:px-3" size="sm" variant="ghost">
                <Link href={`/prompts/${saved.slug}`} target="_blank">
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only sm:not-sr-only">前台</span>
                </Link>
              </Button>
            ) : null}
            <Button
              aria-label="复制为新草稿"
              className="px-2 sm:px-3"
              disabled={busy}
              loading={pending === "duplicate"}
              size="sm"
              title="复制为新草稿"
              type="button"
              variant="ghost"
              onClick={duplicate}
            >
              <Copy aria-hidden="true" className="size-4" />
            </Button>
            <Button
              aria-label="删除"
              className="px-2 text-danger hover:bg-danger/10 hover:text-danger sm:px-3"
              disabled={busy}
              loading={pending === "delete"}
              size="sm"
              title="删除"
              type="button"
              variant="ghost"
              onClick={remove}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
            <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-border sm:block" />
            {isPublished ? (
              <>
                <Button
                  disabled={busy}
                  loading={pending === "unpublish"}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => changeStatus("unpublish")}
                >
                  <Undo2 aria-hidden="true" className="size-4" />
                  下线
                </Button>
                <Button disabled={busy || !dirty} loading={pending === "save"} size="sm" type="submit">
                  <Save aria-hidden="true" className="size-4" />
                  保存更新
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={busy || !dirty}
                  loading={pending === "save"}
                  size="sm"
                  type="submit"
                  variant="outline"
                >
                  <Save aria-hidden="true" className="size-4" />
                  保存草稿
                </Button>
                <Button
                  disabled={busy}
                  loading={pending === "publish"}
                  size="sm"
                  type="button"
                  onClick={() => changeStatus("publish")}
                >
                  <Send aria-hidden="true" className="size-4" />
                  发布
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
