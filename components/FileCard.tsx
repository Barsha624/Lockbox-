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

const MAX_TAGS_SHOWN = 3;

interface Props {
  file: FileItem;
  thumbUrl?: string;
  analyzing: boolean;
  selected: boolean;
  index: number; // position in the grid, used to stagger the entrance animation
  onOpen: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onDelete: (file: FileItem) => Promise<void>;
  onAnalyze: (file: FileItem) => void;
  onToggleStar: (file: FileItem) => void;
  onShare: (file: FileItem, minutes: number) => Promise<void>;
  onSelect: (file: FileItem) => void;
}

type Mode = "idle" | "delete" | "share";

/** One file as a card: a picture (or a coloured tile with the AI summary), tags, and the actions. */
export default function FileCard({
  file,
  thumbUrl,
  analyzing,
  selected,
  index,
  onOpen,
  onPreview,
  onDelete,
  onAnalyze,
  onToggleStar,
  onShare,
  onSelect,
}: Props) {
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const kind = KIND[file.category];
  const fromAi = file.analyzedBy === "ai";
  const previewable = file.category === "Images" || file.category === "PDFs";
  const showPicture = file.category === "Images" && !!thumbUrl && !imageFailed;
  const shownTags = file.tags.slice(0, MAX_TAGS_SHOWN);
  const hiddenTags = file.tags.length - shownTags.length;

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
    <li
      style={{ animationDelay: `${Math.min(index, 11) * 35}ms` }}
      className={`fade-up lift group flex flex-col overflow-hidden rounded-2xl border bg-surface shadow-sm shadow-black/5 ${
        selected ? "border-teal ring-2 ring-teal/40" : "border-line"
      }`}
    >
      <div className="relative h-36 overflow-hidden">
        <button
          type="button"
          onClick={() => onPreview(file)}
          aria-label={previewable ? `Preview ${file.name}` : `Download ${file.name}`}
          className="absolute inset-0 block h-full w-full text-left"
        >
          {showPicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt={file.summary ?? ""}
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className={`relative block h-full overflow-hidden p-4 pt-11 ${kind.tint}`}>
              <Icon name={kind.icon} className="absolute -bottom-3 -right-3 h-24 w-24 opacity-15" />
              <span className="relative line-clamp-3 text-sm leading-snug">
                {analyzing
                  ? "Reading the file and writing tags…"
                  : (file.summary ?? "No summary yet. Press Add tags below.")}
              </span>
            </span>
          )}
        </button>

        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(file)}
          aria-label={`Select ${file.name}`}
          className="absolute left-2.5 top-2.5 h-[18px] w-[18px] cursor-pointer rounded accent-teal"
        />
        <button
          type="button"
          onClick={() => onToggleStar(file)}
          aria-pressed={file.starred}
          aria-label={file.starred ? `Remove star from ${file.name}` : `Star ${file.name}`}
          title={file.starred ? "Starred" : "Star"}
          className={`absolute right-2.5 top-2.5 rounded-full bg-black/40 p-1.5 backdrop-blur transition hover:bg-black/55 ${
            file.starred ? "text-amber-300" : "text-white"
          }`}
        >
          <Icon name="star" filled={file.starred} className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="truncate font-medium" title={file.name}>
          {file.name}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {formatBytes(file.size)} · {formatDate(file.lastModified)}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {shownTags.map((tag) => (
            <span
              key={tag}
              title={fromAi ? "Written by AI from the file's contents" : "Based on the file type"}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs ${
                fromAi ? "bg-amber-soft text-amber-ink" : "bg-slate-soft text-ink-soft"
              }`}
            >
              {fromAi && <Icon name="sparkle" className="h-3 w-3" />}
              {tag}
            </span>
          ))}
          {hiddenTags > 0 && <span className="rounded-full px-1.5 py-0.5 text-xs text-muted">+{hiddenTags}</span>}
          {!file.summary && !analyzing && (
            <button
              type="button"
              onClick={() => onAnalyze(file)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-0.5 text-xs font-medium text-ink-soft transition hover:border-teal hover:text-accent"
            >
              <Icon name="sparkle" className="h-3 w-3" />
              Add tags
            </button>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-1.5 pt-4">
          {mode === "delete" && (
            <>
              <span className="mr-auto text-sm text-ink-soft">Delete this file?</span>
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
              <span className="mr-auto text-sm text-ink-soft">Link works for</span>
              {SHARE_OPTIONS.map((o) => (
                <button
                  key={o.minutes}
                  onClick={() => run(() => onShare(file, o.minutes))}
                  disabled={busy}
                  className="rounded-lg border border-line px-2.5 py-1 text-xs transition hover:border-teal hover:text-accent disabled:opacity-60"
                >
                  {o.label}
                </button>
              ))}
              <button
                onClick={() => setMode("idle")}
                disabled={busy}
                className="rounded-lg px-2 py-1 text-xs text-ink-soft transition hover:bg-slate-soft"
              >
                Cancel
              </button>
            </>
          )}

          {mode === "idle" && (
            <>
              <button
                onClick={() => onOpen(file)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-teal hover:text-accent active:scale-95"
              >
                <Icon name="open" className="h-4 w-4" />
                {previewable ? "Open" : "Download"}
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
      </div>
    </li>
  );
}
