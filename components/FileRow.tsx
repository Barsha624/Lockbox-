"use client";

import { useState } from "react";
import { Icon, type IconName } from "./Icon";
import { formatBytes, formatDate } from "../lib/format";
import { SHARE_OPTIONS, type Category, type FileItem } from "../lib/types";

const KIND: Record<Category, { icon: IconName; tint: string }> = {
  Images: { icon: "image", tint: "bg-sky-soft text-sky-ink" },
  PDFs: { icon: "file", tint: "bg-rose-soft text-rose-ink" },
  Documents: { icon: "text", tint: "bg-indigo-soft text-indigo-ink" },
  Other: { icon: "archive", tint: "bg-slate-soft text-ink-soft" },
};

interface Props {
  file: FileItem;
  analyzing: boolean;
  onOpen: (file: FileItem) => void;
  onDelete: (file: FileItem) => Promise<void>;
  onAnalyze: (file: FileItem) => void;
  onToggleStar: (file: FileItem) => void;
  onShare: (file: FileItem, minutes: number) => Promise<void>;
}

type Mode = "idle" | "delete" | "share";

export default function FileRow({ file, analyzing, onOpen, onDelete, onAnalyze, onToggleStar, onShare }: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const kind = KIND[file.category];
  const fromAi = file.analyzedBy === "ai";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setMode("idle");
    }
  }

  return (
    <li className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-paper/70 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${kind.tint}`}>
          <Icon name={kind.icon} />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {formatBytes(file.size)} · {formatDate(file.lastModified)}
          </p>

          {analyzing ? (
            <p className="mt-2 text-sm text-muted motion-safe:animate-pulse">Reading the file and writing tags…</p>
          ) : file.summary ? (
            <>
              <p className="mt-2 text-sm leading-snug text-ink-soft">{file.summary}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
                {file.tags.map((tag) => (
                  <li
                    key={tag}
                    title={fromAi ? "Written by AI from the file's contents" : "Based on the file type"}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                      fromAi ? "bg-amber-soft text-amber-ink" : "bg-slate-soft text-ink-soft"
                    }`}
                  >
                    {fromAi && <Icon name="sparkle" className="h-3 w-3" />}
                    {tag}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <button
              onClick={() => onAnalyze(file)}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:border-teal hover:text-accent"
            >
              <Icon name="sparkle" className="h-3.5 w-3.5" />
              Add tags
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {mode === "delete" && (
          <>
            <span className="mr-1 text-sm text-ink-soft">Delete this file?</span>
            <button
              onClick={() => setMode("idle")}
              disabled={busy}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-soft transition hover:bg-slate-soft"
            >
              Keep
            </button>
            <button
              onClick={() => run(() => onDelete(file))}
              disabled={busy}
              className="rounded-lg bg-danger-solid px-3 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </>
        )}

        {mode === "share" && (
          <>
            <span className="mr-1 text-sm text-ink-soft">Link works for</span>
            {SHARE_OPTIONS.map((o) => (
              <button
                key={o.minutes}
                onClick={() => run(() => onShare(file, o.minutes))}
                disabled={busy}
                className="rounded-lg border border-line px-3 py-1.5 text-sm transition hover:border-teal hover:text-accent disabled:opacity-60"
              >
                {o.label}
              </button>
            ))}
            <button
              onClick={() => setMode("idle")}
              disabled={busy}
              className="rounded-lg px-2.5 py-1.5 text-sm text-ink-soft transition hover:bg-slate-soft"
            >
              Cancel
            </button>
          </>
        )}

        {mode === "idle" && (
          <>
            <button
              onClick={() => onToggleStar(file)}
              aria-pressed={file.starred}
              aria-label={file.starred ? `Remove star from ${file.name}` : `Star ${file.name}`}
              title={file.starred ? "Starred" : "Star"}
              className={`rounded-lg p-2 transition hover:bg-slate-soft ${file.starred ? "text-amber-ink" : "text-muted"}`}
            >
              <Icon name="star" filled={file.starred} className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => onOpen(file)}
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-1.5 text-sm font-medium transition hover:border-teal hover:text-accent"
            >
              <Icon name="open" className="h-4 w-4" />
              {file.category === "Images" || file.category === "PDFs" ? "Open" : "Download"}
            </button>
            <button
              onClick={() => setMode("share")}
              aria-label={`Create a share link for ${file.name}`}
              title="Share link"
              className="rounded-lg p-2 text-muted transition hover:bg-slate-soft hover:text-accent"
            >
              <Icon name="link" className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => setMode("delete")}
              aria-label={`Delete ${file.name}`}
              title="Delete"
              className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger"
            >
              <Icon name="trash" className="h-[18px] w-[18px]" />
            </button>
          </>
        )}
      </div>
    </li>
  );
}
