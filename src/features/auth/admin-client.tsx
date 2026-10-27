"use client";

import { createContext, useContext } from "react";

const AdminContext = createContext({ csrfToken: "" });

export function AdminSessionProvider({
  csrfToken,
  children,
}: {
  csrfToken: string;
  children: React.ReactNode;
}) {
  return <AdminContext.Provider value={{ csrfToken }}>{children}</AdminContext.Provider>;
}

export function useCsrfToken(): string {
  return useContext(AdminContext).csrfToken;
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;

  constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function errorMessage(error: unknown, fallback = "请求失败"): string {
  if (error instanceof AdminApiError) {
    const fieldText = Object.values(error.fields).join("；");
    return fieldText && error.status === 422 ? `${error.message}：${fieldText}` : error.message;
  }
  if (error instanceof TypeError) {
    return "网络连接失败，请稍后重试";
  }
  return error instanceof Error ? error.message : fallback;
}

export async function adminFetch<T>(
  path: string,
  csrfToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", csrfToken);
  if (init.body && typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string; fields?: Record<string, string> };
  };
  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      payload.error?.code ?? "REQUEST_FAILED",
      payload.error?.message ?? "请求失败",
      payload.error?.fields ?? {},
    );
  }
  return payload.data as T;
}
