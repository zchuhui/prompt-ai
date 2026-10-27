export type CardImage = {
  id: string;
  width: number;
  height: number;
  alt: string | null;
};

export type PromptCard = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  publishedAt: string | null;
  modelName: string | null;
  modelSlug: string | null;
  imageCount: number;
  cover: CardImage | null;
};

export type PromptCardPage = {
  total: number;
  page: number;
  pageSize: number;
  items: PromptCard[];
};
