import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-gradient font-mono text-6xl font-semibold tracking-tight">404</p>
      <h1 className="mt-6 text-2xl font-semibold">页面不存在</h1>
      <p className="mt-3 text-muted">这条内容可能尚未发布，或链接已经失效。</p>
      <Button asChild className="mt-8">
        <Link href="/">回到图片库</Link>
      </Button>
    </main>
  );
}
