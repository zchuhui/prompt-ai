"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createUploadStore, type UploadOptions } from "./upload-store";

const empty: never[] = [];

export function useUploadQueue(options: UploadOptions) {
  const [store] = useState(() => createUploadStore(options));
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, () => empty);

  useEffect(() => {
    store.configure(options);
  });

  useEffect(() => {
    const detach = store.attach();
    const onVisible = () => {
      if (!document.hidden) {
        store.resume();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      detach();
    };
  }, [store]);

  return { entries, store };
}
