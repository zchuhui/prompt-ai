export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-6 py-16">
      <p className="text-sm text-accent">Prompt Gallery</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        图片生成提示词灵感库
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted">
        浏览效果图，找到感兴趣的内容，查看提示词并复制使用。
      </p>
    </main>
  );
}
