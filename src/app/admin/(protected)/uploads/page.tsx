"use client";

import { useEffect, useState } from "react";
import { useCsrfToken } from "@/features/auth/admin-client";

type BatchItem = {
  id: string;
  clientItemId: string;
  promptId: string | null;
  status: string;
  errorCode: string | null;
  fileName: string;
  declaredSize: number;
};

export default function UploadsPage() {
  const csrfToken = useCsrfToken();
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [message, setMessage] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);

  useEffect(() => {
    if (!batchId) {
      return;
    }
    let timer = 0;
    const tick = () => {
      if (document.hidden) {
        return;
      }
      void fetch(`/api/v1/admin/upload-batches/${batchId}`, {
        headers: { "x-csrf-token": csrfToken },
      })
        .then((response) => response.json())
        .then((payload: { data?: { items: BatchItem[] } }) => {
          if (payload.data) {
            setItems(payload.data.items);
          }
        });
    };
    timer = window.setInterval(tick, 2000);
    const started = Date.now();
    const slow = window.setTimeout(() => {
      setMessage("处理时间较长，可以稍后返回此页面查看。");
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(slow);
      void started;
    };
  }, [batchId, csrfToken]);

  async function onFiles(fileList: FileList | null) {
    const files = [...(fileList ?? [])];
    if (files.length === 0) {
      return;
    }
    const response = await fetch("/api/v1/admin/upload-batches", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": csrfToken,
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        mode,
        items: files.map((file) => ({
          clientItemId: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
        })),
      }),
    });
    const payload = (await response.json()) as {
      data?: { batchId: string; items: BatchItem[] };
      error?: { message: string };
    };
    if (!response.ok || !payload.data) {
      setMessage(payload.error?.message ?? "无法创建上传");
      return;
    }
    setBatchId(payload.data.batchId);
    setItems(payload.data.items);
    payload.data.items.forEach((item, index) => {
      const file = files[index];
      if (!file) {
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/v1/admin/upload-items/${item.id}/file`);
      xhr.setRequestHeader("x-csrf-token", csrfToken);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        setMessage(`${file.name} ${Math.round((event.loaded / event.total) * 100)}%`);
      };
      xhr.send(file);
    });
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">上传</h1>
      <fieldset className="mt-6 flex gap-4 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2">
          <input checked={mode === "single"} name="mode" type="radio" onChange={() => setMode("single")} />
          多张图片创建一条内容
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <input checked={mode === "multiple"} name="mode" type="radio" onChange={() => setMode("multiple")} />
          每张图片创建一条草稿
        </label>
      </fieldset>
      <label className="mt-4 block">
        <span className="text-sm">选择图片</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block"
          multiple
          type="file"
          onChange={(event) => {
            void onFiles(event.target.files);
          }}
        />
      </label>
      {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {items.map((item) => (
          <li className="border border-border px-3 py-2 text-sm" key={item.id}>
            {item.fileName} · {item.status}
            {item.errorCode ? ` · ${item.errorCode}` : ""}
            {item.promptId ? (
              <a className="ml-3 underline" href={`/admin/prompts/${item.promptId}/edit`}>编辑草稿</a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
