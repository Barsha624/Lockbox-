"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { getDownloadUrl } from "../lib/client";
import { formatBytes, formatDate } from "../lib/format";
import type { FileItem } from "../lib/types";

interface Props {
  file: FileItem;
  position: number; // 1-based place in the list of previewable files
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onOpenTab: (file: FileItem) => void;
}

type Loaded = { key: string; url: string | null; error: string | null };

/** A full-page pop-up that shows an image or PDF without leaving the dashboard. */
export default function PreviewModal({ file, position, total, onPrev, onNext, onClose, onOpenTab }: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Ask the server for a short-lived link each time the file changes.
  useEffect(() => {
    let cancelled = false;
    getDownloadUrl(file.key)
      .then((url) => !cancelled && setLoaded({ key: file.key, url, error: null }))
      .catch((err) => !cancelled && setLoaded({ key: file.key, url: null, error: err instanceof Error ? err.message : "Could not load the preview." }));
    return () => {
      cancelled = true;
    };
  }, [file.key]);

  // Keyboard: Esc closes, arrows move between files. Page scroll is locked while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, onPrev, onNext]);

  const ready = loaded && loaded.key === file.key ? loaded : null;
  const isImage = file.category === "Images";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${file.name}`}
      className="modal-fade fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-white sm:px-6" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="text-xs text-white/60">
            {formatBytes(file.size)} · {formatDate(file.lastModified)}
            {total > 1 ? ` · ${position} of ${total}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenTab(file)}
          className="hidden rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 sm:inline-flex"
        >
          Open in new tab
        </button>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="rounded-lg bg-white/10 p-2 transition hover:bg-white/20"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
              aria-label="Previous file"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:left-5"
            >
              <Icon name="chevron" className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
              aria-label="Next file"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:right-5"
            >
              <Icon name="chevron" className="h-5 w-5" />
            </button>
          </>
        )}

        <div className="flex h-full w-full max-w-5xl items-center justify-center" onClick={(e) => e.stopPropagation()}>
          {!ready ? (
            <p className="text-sm text-white/70 motion-safe:animate-pulse">Loading preview…</p>
          ) : ready.error || !ready.url ? (
            <p role="alert" className="max-w-sm text-center text-sm text-rose-200">
              {ready.error ?? "Could not load the preview."}
            </p>
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ready.url}
              alt={file.summary ?? file.name}
              className="modal-pop max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            />
          ) : (
            <iframe
              src={ready.url}
              title={`Preview of ${file.name}`}
              className="modal-pop h-full w-full rounded-xl bg-white shadow-2xl"
            />
          )}
        </div>
      </div>
    </div>
  );
}
