import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readPageAdmin } from "@/features/auth/server/guards";

export const metadata: Metadata = {
  title: "后台 · Prompt Gallery",
  robots: { index: false, follow: false },
};

export default async function AdminHomePage() {
  const admin = await readPageAdmin();
  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold tracking-tight">已登录</h1>
      <ul className="mt-6 flex flex-col gap-3 text-base">
        <li><Link href="/admin/prompts">管理内容</Link></li>
        <li><Link href="/admin/uploads">上传图片</Link></li>
        <li><Link href="/admin/taxonomies">分类、标签与模型</Link></li>
        <li><Link href="/admin/collections">专题合集</Link></li>
      </ul>
    </section>
  );
}
