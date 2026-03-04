"use client";

import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";

interface LoadingItem {
  id: number;
  label?: string;
}

interface LoadingContextValue {
  start: (label?: string) => number;
  stop: (id: number) => void;
  active: LoadingItem[];
}

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingItems, setLoadingItems] = useState<LoadingItem[]>([]);

  const start = useCallback((label?: string) => {
    const id = Date.now() + Math.random();
    setLoadingItems((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const stop = useCallback((id: number) => {
    setLoadingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const loadingValue = useMemo(() => ({ start, stop, active: loadingItems }), [start, stop, loadingItems]);

  return (
    <LoadingContext.Provider value={loadingValue}>
      {children}
      <LoadingOverlay />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within LoadingProvider");
  return ctx;
}

function LoadingOverlay() {
  const ctx = useContext(LoadingContext);
  if (!ctx || ctx.active.length === 0) return null;
  const latest = ctx.active[ctx.active.length - 1];
  return (
    <div className="fixed inset-0 z-40 bg-white/70 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-2 text-slate-600">
        <span className="material-icons animate-spin text-2xl">refresh</span>
        <span className="text-sm font-medium">{latest.label || "데이터를 불러오는 중"}</span>
      </div>
    </div>
  );
}
