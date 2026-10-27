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

export async function adminFetch<T>(
  path: string,
  csrfToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-csrf-token", csrfToken);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string; fields?: Record<string, string> };
  };
  if (!response.ok) {
    const fieldText = payload.error?.fields
      ? Object.values(payload.error.fields).join(" ")
      : "";
    throw new Error(payload.error?.message ?? (fieldText || "请求失败"));
  }
  return payload.data as T;
}
