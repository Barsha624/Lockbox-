"use client";

import { useRef, useState } from "react";
import { Icon } from "./Icon";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB } from "../lib/types";

export interface UploadState {
  id: string;
  name: string;
  progress: number;
  phase: "uploading" | "tagging" | "done" | "error";
  error?: string;
}

const PHASE_TEXT: Record<UploadState["phase"], string> = {
  uploading: "Uploading",
  tagging: "Tagging",
  done: "Stored",
  error: "Failed",
};

export default function UploadZone({ onFiles, uploads }: { onFiles: (files: File[]) => void; uploads: UploadState[] }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function take(list: FileList | null) {
    if (list && list.length > 0) onFiles(Array.from(list));
    if (inputRef.current) inputRef.current.value = ""; // lets you pick the same file again
  }

  return (
    <section aria-label="Upload files">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-9 text-center transition focus-within:ring-2 focus-within:ring-teal focus-within:ring-offset-2 focus-within:ring-offset-paper ${
          dragging ? "border-teal bg-teal-soft" : "border-teal/40 bg-surface hover:border-teal hover:bg-teal-soft/50"
        }`}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTRIBUTE} onChange={(e) => take(e.target.files)} className="sr-only" />
        <span className={`flex h-12 w-12 items-center justify-center rounded-full transition ${dragging ? "bg-teal text-white" : "bg-teal-soft text-accent"}`}>
          <Icon name="upload" className="h-6 w-6" />
        </span>
        <p className="font-medium">{dragging ? "Drop to upload" : "Drop files here, or choose from your device"}</p>
        <p className="text-sm text-muted">Images, PDFs, documents and zips up to {MAX_UPLOAD_MB} MB each</p>
      </label>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u) => (
            <li key={u.id} className="rounded-xl border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium">{u.name}</span>
                <span className={u.phase === "error" ? "text-danger" : "text-muted"}>
                  {PHASE_TEXT[u.phase]}
                  {u.phase === "uploading" ? ` ${u.progress}%` : ""}
                </span>
              </div>
              {u.phase === "error" ? (
                <p className="mt-1 text-xs text-danger">{u.error}</p>
              ) : (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={u.progress}
                  aria-label={`${PHASE_TEXT[u.phase]} ${u.name}`}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
                >
                  <div
                    className={`h-full rounded-full bg-teal transition-[width] duration-200 ${u.phase === "tagging" ? "motion-safe:animate-pulse" : ""}`}
                    style={{ width: `${u.phase === "tagging" || u.phase === "done" ? 100 : u.progress}%` }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
