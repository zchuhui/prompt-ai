import { ImageOff, Layers } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/utils";
import type { CardImage, PromptCard } from "../types";

const MIN_RATIO = 0.56;
const MAX_RATIO = 2;

export const GALLERY_SIZES =
  "(min-width: 1440px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

export function cardRatio(image: { width: number; height: number }): number {
  const ratio = image.width / Math.max(1, image.height);
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
}

export function mediaSrc(id: string, variant: "card" | "detail" | "original"): string {
  return `/api/v1/media/${id}/${variant}`;
}

export function CardPicture({
  image,
  alt,
  priority = false,
  sizes = GALLERY_SIZES,
  className,
}: {
  image: CardImage;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  return (
    <img
      alt={alt}
      className={cn("absolute inset-0 size-full object-contain", className)}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      height={image.height}
      loading={priority ? "eager" : "lazy"}
      sizes={sizes}
      src={mediaSrc(image.id, "card")}
      srcSet={`${mediaSrc(image.id, "card")} 640w, ${mediaSrc(image.id, "detail")} 1920w`}
      width={image.width}
    />
  );
}

export function GalleryCard({
  card,
  priority = false,
  titleAs: Title = "h2",
}: {
  card: PromptCard;
  priority?: boolean;
  titleAs?: "h2" | "h3";
}) {
  const ratio = card.cover ? cardRatio(card.cover) : 1;
  return (
    <Link
      className="glow-card group block overflow-hidden rounded-xl"
      href={`/prompts/${card.slug}`}
    >
      <div className="relative overflow-hidden bg-surface-2" style={{ aspectRatio: ratio }}>
        {card.cover ? (
          <CardPicture
            alt={card.cover.alt ?? card.title}
            className="motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
            image={card.cover}
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted">
            <ImageOff aria-hidden="true" className="size-6" />
          </div>
        )}
        {card.imageCount > 1 ? (
          <Badge className="absolute top-2 right-2" tone="glass">
            <Layers aria-hidden="true" className="size-3" />
            {card.imageCount} 张
          </Badge>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <Title className="line-clamp-2 text-sm leading-5 font-medium text-white drop-shadow">
            {card.title}
          </Title>
          <p className="mt-1 truncate font-mono text-[11px] text-white/65">
            {card.modelName ?? "未标注模型"}
          </p>
        </div>
      </div>
    </Link>
  );
}
