"use client";

import { Icon } from "./Icon";

export interface Toast {
  id: string;
  kind: "success" | "error" | "info";
  text: string;
}

export default function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-deep px-4 py-3 text-sm text-white shadow-lg shadow-black/20"
        >
          <Icon
            name={t.kind === "error" ? "alert" : "check"}
            className={`mt-0.5 h-4 w-4 shrink-0 ${t.kind === "error" ? "text-rose-300" : "text-teal-300"}`}
          />
          <p className="flex-1 leading-snug">{t.text}</p>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="-mr-1 rounded p-0.5 text-white/60 hover:text-white"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
