"use client";

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Types ── */
export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

/* ── Context ── */
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/* ── Provider ── */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      // Auto dismiss after 4 seconds
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast],
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ── Toast Item ── */
const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: typeof CheckCircle2; iconClass: string }> = {
  success: { bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, iconClass: "text-emerald-500" },
  error: { bg: "bg-red-500/10 border-red-500/30", icon: AlertCircle, iconClass: "text-red-500" },
  info: { bg: "bg-blue-500/10 border-blue-500/30", icon: Info, iconClass: "text-blue-500" },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const style = VARIANT_STYLES[toast.variant];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm",
        "toast-slide-in",
        "min-w-[280px] max-w-[420px]",
        style.bg,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", style.iconClass)} />
      <span className="text-sm text-foreground flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
