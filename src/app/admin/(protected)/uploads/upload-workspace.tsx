"use client";

import { Images, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/components/ui/utils";
import { UploadQueue } from "@/features/uploads/components/upload-queue";
import { UPLOAD_BATCH_MAX_ITEMS, UPLOAD_SINGLE_MAX_ITEMS } from "@/shared/constants";

type Option = { id: string; name: string };

const modes = [
  {
    value: "multiple",
    icon: LayoutGrid,
    title: "每张图一条草稿",
    body: `适合批量入库，每次最多 ${UPLOAD_BATCH_MAX_ITEMS} 张。`,
  },
  {
    value: "single",
    icon: Images,
    title: "多张图合成一条",
    body: `同一提示词的多张效果图，每次最多 ${UPLOAD_SINGLE_MAX_ITEMS} 张。`,
  },
] as const;

export function UploadWorkspace({
  categories,
  models,
  tags,
}: {
  categories: Option[];
  models: Option[];
  tags: Option[];
}) {
  const [mode, setMode] = useState<"single" | "multiple">("multiple");
  const [categoryId, setCategoryId] = useState("");
  const [modelId, setModelId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);

  const defaults = {
    ...(categoryId ? { categoryId } : {}),
    ...(modelId ? { modelId } : {}),
    ...(tagIds.length > 0 ? { tagIds } : {}),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid content-start gap-4">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">上传方式</legend>
          {modes.map(({ value, icon: Icon, title, body }) => (
            <label
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent/50",
                mode === value ? "border-accent/50 bg-accent/5" : "border-border bg-surface/50 hover:border-border-strong",
              )}
              key={value}
            >
              <input
                checked={mode === value}
                className="sr-only"
                name="mode"
                type="radio"
                value={value}
                onChange={() => setMode(value)}
              />
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg border",
                  mode === value ? "border-accent/40 bg-accent/10 text-accent" : "border-border text-muted",
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <UploadQueue
          defaults={defaults}
          maxItems={mode === "single" ? UPLOAD_SINGLE_MAX_ITEMS : UPLOAD_BATCH_MAX_ITEMS}
          mode={mode}
          showPromptLinks
        />
      </div>
      <Card className="h-fit lg:sticky lg:top-8">
        <CardHeader description="对之后新建的草稿生效，已上传的不受影响。" title="批量默认值" />
        <div className="grid gap-4 p-5">
          <Field label="分类">
            <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">不设置</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="模型">
            <Select value={modelId} onChange={(event) => setModelId(event.target.value)}>
              <option value="">不设置</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium text-foreground/90">标签</legend>
            {tags.length === 0 ? (
              <p className="text-xs text-muted">还没有标签</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const checked = tagIds.includes(tag.id);
                  return (
                    <label
                      className={cn(
                        "inline-flex min-h-8 cursor-pointer items-center rounded-full border px-3 text-xs transition-colors has-focus-visible:ring-2 has-focus-visible:ring-accent/50",
                        checked
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border text-muted hover:text-foreground",
                      )}
                      key={tag.id}
                    >
                      <input
                        checked={checked}
                        className="sr-only"
                        type="checkbox"
                        onChange={() =>
                          setTagIds((current) =>
                            checked ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                          )
                        }
                      />
                      #{tag.name}
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        </div>
      </Card>
    </div>
  );
}
