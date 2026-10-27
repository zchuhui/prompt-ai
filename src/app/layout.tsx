import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/ui/toast";
import { getEnv } from "@/server/env";
import "./globals.css";

getEnv();

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "图种",
  description: "图种，图片生成 Prompt 灵感库。种下一句，长出想象。浏览效果图，发现并复制提示词。",
};

export const viewport: Viewport = {
  themeColor: "#07080a",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
