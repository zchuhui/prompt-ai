"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button
      aria-label="退出登录"
      loading={pending}
      size="sm"
      type="button"
      variant="ghost"
      onClick={logout}
    >
      {pending ? null : <LogOut aria-hidden="true" className="size-4" />}
      退出
    </Button>
  );
}
