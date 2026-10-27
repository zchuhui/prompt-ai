import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "关于 · Prompt Gallery",
  description: "Prompt Gallery 是面向公众的图片生成提示词灵感库。",
};

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">关于与来源说明</h1>
      <div className="mt-6 flex flex-col gap-4 leading-7">
        <p>
          Prompt Gallery 收集可公开浏览的图片生成提示词和效果图，方便按画面找到写法，再复制到自己的生成工具里使用。
        </p>
        <p>
          每条内容会标明原创或收集。收集内容会尽量保留作者和来源链接。页面上的提示词按录入时的原文显示，包括换行，不会在复制时改写。
        </p>
        <p>
          同一条提示词在不同模型、版本、参数和随机种子下会得到不同画面。需要参考图的内容会单独标出。
        </p>
        <p>访客不需要注册。草稿、已撤回和已删除的内容不会出现在公开页面、搜索或站点地图里。</p>
      </div>
    </main>
  );
}
