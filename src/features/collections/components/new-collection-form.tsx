"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { adminFetch, errorMessage, useCsrfToken } from "@/features/auth/admin-client";

export function NewCollectionForm() {
  const csrfToken = useCsrfToken();
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="flex w-full gap-2 sm:w-auto"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim() || pending) {
          return;
        }
        setPending(true);
        try {
          const created = await adminFetch<{ id: string }>("/api/v1/admin/collections", csrfToken, {
            method: "POST",
            body: JSON.stringify({ title: title.trim() }),
          });
          router.push(`/admin/collections/${created.id}/edit`);
        } catch (error) {
          toast(errorMessage(error, "无法创建合集"), "error");
          setPending(false);
        }
      }}
    >
      <Input
        aria-label="新合集标题"
        className="min-w-0 flex-1 sm:w-64"
        maxLength={120}
        placeholder="新合集标题"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button disabled={!title.trim()} loading={pending} type="submit">
        <Plus aria-hidden="true" className="size-4" />
        新建
      </Button>
    </form>
  );
}
