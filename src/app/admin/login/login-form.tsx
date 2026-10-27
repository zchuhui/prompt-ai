"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      if (!response.ok) {
        setError(payload.error?.message ?? "登录失败");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("登录失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-2 text-sm">
        用户名
        <input
          className="min-h-11 rounded-md border border-border bg-background px-3"
          name="username"
          autoComplete="username"
          required
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        密码
        <input
          className="min-h-11 rounded-md border border-border bg-background px-3"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? (
        <p className="text-sm text-accent" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="min-h-11 rounded-md bg-accent px-4 text-sm text-background disabled:opacity-60"
        type="submit"
        disabled={pending}
      >
        {pending ? "正在登录" : "登录"}
      </button>
    </form>
  );
}
