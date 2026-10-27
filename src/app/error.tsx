"use client";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-16">
      <h1 className="text-3xl font-semibold">页面暂时无法显示</h1>
      <button className="mt-6 min-h-11 w-fit border border-border px-4" type="button" onClick={reset}>
        重试
      </button>
    </main>
  );
}
