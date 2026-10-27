import { Badge } from "@/components/ui/badge";

const labels = {
  draft: { text: "草稿", tone: "warning" },
  published: { text: "已发布", tone: "success" },
  deleted: { text: "已删除", tone: "danger" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof labels }) {
  const { text, tone } = labels[status];
  return (
    <Badge tone={tone}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {text}
    </Badge>
  );
}
