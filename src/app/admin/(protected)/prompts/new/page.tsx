"use client";

import { LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";

export default function NewPromptPage() {
  const router = useRouter();
  const csrfToken = useCsrfToken();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) {
      return;
    }
    started.current = attempt;
    adminFetch<{ id: string }>("/api/v1/admin/prompts", csrfToken, {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: "{}",
    })
      .then((created) => router.replace(`/admin/prompts/${created.id}/edit`))
      .catch((reason: unknown) => setError(errorMessage(reason, "无法创建草稿")));
  }, [attempt, csrfToken, idempotencyKey, router]);

  return (
    <section className="grid min-h-[50vh] place-items-center">
      {error ? (
        <div className="grid max-w-sm justify-items-center gap-4 text-center" role="alert">
          <TriangleAlert aria-hidden="true" className="size-6 text-danger" />
          <p className="text-sm">{error}</p>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href="/admin/prompts">返回列表</Link>
            </Button>
            <Button
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              重试
            </Button>
          </div>
        </div>
      ) : (
        <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          正在创建草稿…
        </p>
      )}
    </section>
  );
}
