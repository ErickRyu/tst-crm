import { createContext, useCallback, useContext, useMemo, useState, useEffect, ReactNode } from "react";

type Tone = "error" | "success" | "info";

interface Toast {
  id: number;
  message: string;
  tone: Tone;
  dismissAt: number;
  onRetry?: () => void;
}

interface ToastContextValue {
  pushToast: (message: string, tone?: Tone, onRetry?: () => void) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

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

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadingItems, setLoadingItems] = useState<LoadingItem[]>([]);

  const pushToast = useCallback((message: string, tone: Tone = "info", onRetry?: () => void) => {
    const id = Date.now() + Math.random();
    const dismissAt = Date.now() + 3500;
    setToasts((prev) => [...prev, { id, message, tone, dismissAt, onRetry }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((t) => t.dismissAt > now));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const start = useCallback((label?: string) => {
    const id = Date.now() + Math.random();
    setLoadingItems((prev) => [...prev, { id, label }]);
    return id;
  }, []);

  const stop = useCallback((id: number) => {
    setLoadingItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toastValue = useMemo(() => ({ pushToast, dismiss }), [pushToast, dismiss]);
  const loadingValue = useMemo(() => ({ start, stop, active: loadingItems }), [start, stop, loadingItems]);

  return (
    <ToastContext.Provider value={toastValue}>
      <LoadingContext.Provider value={loadingValue}>
        {children}
        <LoadingOverlay />
        <ToastStack toasts={toasts} />
      </LoadingContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within FeedbackProvider");
  return ctx;
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error("useLoading must be used within FeedbackProvider");
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

function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[320px] max-w-[90vw]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const { dismiss } = useToast();
  const toneClasses: Record<Tone, string> = {
    error: "bg-red-600 text-white",
    success: "bg-emerald-600 text-white",
    info: "bg-slate-800 text-white",
  };
  return (
    <div className={`px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-sm ${toneClasses[toast.tone]}`}>
      <span className="material-icons text-base">
        {toast.tone === "error" ? "error" : toast.tone === "success" ? "check_circle" : "info"}
      </span>
      <span className="truncate">{toast.message}</span>
      {toast.onRetry && (
        <button onClick={toast.onRetry} className="underline text-xs">
          재시도
        </button>
      )}
      <button onClick={() => dismiss(toast.id)} className="text-white/80 hover:text-white" aria-label="닫기"><span className="material-icons text-sm">close</span></button>
    </div>
  );
}
