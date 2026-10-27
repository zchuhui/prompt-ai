"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    try {
      await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "x-csrf-token": csrfToken },
      });
    } finally {
      router.push("/admin/login");
      router.refresh();
    }
  }

  return (
    <button
      className="min-h-11 rounded-md border border-border px-4 text-sm"
      type="button"
      onClick={logout}
      disabled={pending}
    >
      退出
    </button>
  );
}
