"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch, useCsrfToken } from "@/features/auth/admin-client";

export default function NewPromptPage() {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [message, setMessage] = useState<string | null>(null);

  async function createDraft() {
    try {
      const created = await adminFetch<{ id: string }>("/api/v1/admin/prompts", csrfToken, {
        method: "POST",
        body: "{}",
      });
      router.push(`/admin/prompts/${created.id}/edit`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法创建");
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">新建草稿</h1>
      <button className="mt-6 min-h-11 bg-accent px-4 text-sm text-background" type="button" onClick={createDraft}>
        创建空草稿
      </button>
      {message ? <p className="mt-3 text-sm">{message}</p> : null}
    </section>
  );
}
