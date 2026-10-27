"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "./utils";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string, tone: Tone = "info") => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { id, tone, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
        role="status"
      >
        {toasts.map((toast) => (
          <div
            className={cn(
              "fade-in pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border bg-surface-2/95 px-4 py-2.5 text-sm shadow-2xl backdrop-blur",
              toast.tone === "error" ? "border-danger/40" : "border-accent/30",
            )}
            key={toast.id}
          >
            {toast.tone === "error" ? (
              <CircleAlert aria-hidden="true" className="size-4 text-danger" />
            ) : (
              <CircleCheck aria-hidden="true" className="size-4 text-accent" />
            )}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
