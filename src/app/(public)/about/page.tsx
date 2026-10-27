import { Copy, Eye, FileText, Shuffle } from "lucide-react";
import type { Metadata } from "next";
import { Eyebrow } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "关于 · Prompt Gallery",
  description: "Prompt Gallery 是面向公众的图片生成提示词灵感库。",
};

const points = [
  {
    icon: Eye,
    title: "按画面找写法",
    body: "Prompt Gallery 收集可公开浏览的图片生成提示词和效果图，方便按画面找到写法，再复制到自己的生成工具里使用。",
  },
  {
    icon: FileText,
    title: "标明来源",
    body: "每条内容会标明原创或收集。收集内容会尽量保留作者和来源链接。",
  },
  {
    icon: Copy,
    title: "原文复制",
    body: "页面上的提示词按录入时的原文显示，包括换行，不会在复制时改写。",
  },
  {
    icon: Shuffle,
    title: "效果会有差异",
    body: "同一条提示词在不同模型、版本、参数和随机种子下会得到不同画面。需要参考图的内容会单独标出。",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-10 pb-16 md:px-6 md:pt-14">
      <Eyebrow>About</Eyebrow>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">关于与来源说明</h1>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {points.map(({ icon: Icon, title, body }) => (
          <li className="rounded-xl border border-border bg-surface/60 p-5" key={title}>
            <span className="flex size-9 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <h2 className="mt-4 font-medium">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 rounded-xl border border-border bg-surface/40 px-5 py-4 text-sm leading-7 text-muted">
        访客不需要注册。草稿、已撤回和已删除的内容不会出现在公开页面、搜索或站点地图里。
      </p>
    </main>
  );
}
