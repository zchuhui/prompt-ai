import { z } from "zod";

const uuid = z.uuid();

const optionalText = (max: number) =>
  z.string().max(max).nullable().optional();

const httpUrl = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "只允许 http 或 https")
  .nullable()
  .optional();

export const assetItemSchema = z.object({
  assetId: uuid,
  position: z.number().int().nonnegative(),
  alt: z.string().max(300).nullable().optional(),
});

export const promptPatchSchema = z.object({
  version: z.number().int().positive(),
  title: z.string().max(120).optional(),
  summary: optionalText(500),
  promptText: z.string().max(50000).optional(),
  negativePrompt: optionalText(10000),
  usageNotes: optionalText(10000),
  parametersText: optionalText(10000),
  modelVersion: optionalText(120),
  aspectRatio: optionalText(32),
  requiresReference: z.boolean().optional(),
  sourceType: z.enum(["original", "collected"]).optional(),
  sourceAuthor: optionalText(120),
  sourceUrl: httpUrl,
  categoryId: uuid.nullable().optional(),
  modelId: uuid.nullable().optional(),
  tagIds: z.array(uuid).max(20).optional(),
  assetItems: z.array(assetItemSchema).max(20).optional(),
  coverAssetId: uuid.nullable().optional(),
});

export const batchPromptSchema = z.object({
  action: z.enum(["publish", "unpublish", "delete"]),
  items: z
    .array(
      z.object({
        id: uuid,
        version: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(100),
});

export const uploadDefaultsSchema = z.object({
  categoryId: uuid.optional(),
  modelId: uuid.optional(),
  tagIds: z.array(uuid).max(20).optional(),
  replaceAssets: z.boolean().optional(),
});

export const uploadBatchSchema = z.object({
  mode: z.enum(["single", "multiple"]),
  targetPromptId: uuid.optional(),
  defaults: uploadDefaultsSchema.optional(),
  items: z
    .array(
      z.object({
        clientItemId: z.string().min(1).max(80),
        name: z.string().min(1).max(300),
        size: z.number().int().nonnegative(),
        type: z.string().min(1).max(120),
      }),
    )
    .min(1)
    .max(100),
});

export type PromptPatch = z.infer<typeof promptPatchSchema>;
export type UploadBatchInput = z.infer<typeof uploadBatchSchema>;
