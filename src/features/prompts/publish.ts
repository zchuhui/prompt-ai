export type PublishImage = {
  id: string;
  status: string;
};

export type PublishInput = {
  title: string;
  promptText: string;
  categoryId: string | null;
  modelId: string | null;
  modelActive: boolean | null;
  requireActiveModel: boolean;
  coverAssetId: string | null;
  images: PublishImage[];
};

export function publishFieldErrors(input: PublishInput): Record<string, string> {
  const fields: Record<string, string> = {};
  const title = input.title.trim();
  if (title.length < 1 || title.length > 120) {
    fields.title = "标题需要 1 到 120 个字符";
  }
  if (input.promptText.length < 1 || input.promptText.length > 50000) {
    fields.promptText = "主 Prompt 需要 1 到 50000 个字符";
  }
  if (!input.categoryId) {
    fields.categoryId = "需要选择分类";
  }
  if (!input.modelId) {
    fields.modelId = "需要选择模型";
  } else if (input.requireActiveModel && input.modelActive !== true) {
    fields.modelId = "新发布只能使用启用中的模型";
  }
  if (input.images.length < 1 || input.images.length > 20) {
    fields.assetItems = "需要 1 到 20 张图片";
  } else if (input.images.some((image) => image.status !== "ready")) {
    fields.assetItems = "图片处理完成后才能发布";
  }
  const coverIsMember = input.images.some(
    (image) => image.id === input.coverAssetId && image.status === "ready",
  );
  if (!coverIsMember) {
    fields.coverAssetId = "封面必须是这条内容里的图片";
  }
  return fields;
}
