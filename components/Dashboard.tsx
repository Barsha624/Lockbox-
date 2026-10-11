"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import AskVault from "./AskVault";
import FileRow from "./FileRow";
import { Icon } from "./Icon";
import Sidebar, { type View } from "./Sidebar";
import StatsStrip from "./StatsStrip";
import ThemeToggle from "./ThemeToggle";
import Toasts, { type Toast } from "./Toasts";
import UploadZone, { type UploadState } from "./UploadZone";
import {
  analyzeFile,
  ApiError,
  deleteFile,
  fetchFiles,
  getDownloadUrl,
  shareFile,
  starFile,
  uploadFile,
} from "../lib/client";
import { formatBytes } from "../lib/format";
import { checkUpload, type FileItem } from "../lib/types";

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Sort = "newest" | "oldest" | "name" | "size";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A to Z" },
  { value: "size", label: "Largest first" },
];

function sortFiles(list: FileItem[], sort: Sort): FileItem[] {
  const copy = [...list];
  if (sort === "oldest") copy.sort((a, b) => a.lastModified.localeCompare(b.lastModified));
  else if (sort === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === "size") copy.sort((a, b) => b.size - a.size);
  else copy.sort((a, b) => b.lastModified.localeCompare(a.lastModified));
  return copy;
}

export default function Dashboard({
  user,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [region, setRegion] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("All");
  const [sort, setSort] = useState<Sort>("newest");
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((kind: Toast["kind"], text: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4000);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchFiles();
      setFiles(data.files);
      setRegion(data.region);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut({ callbackUrl: "/" });
        return;
      }
      notify("error", err instanceof Error ? err.message : "Could not load your files.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runAnalyze = useCallback(
    async (key: string) => {
      setAnalyzing((s) => new Set(s).add(key));
      try {
        const r = await analyzeFile(key);
        setFiles((prev) =>
          prev.map((f) =>
            f.key === key ? { ...f, category: r.category, summary: r.summary, tags: r.tags, analyzedBy: r.source } : f,
          ),
        );
      } catch (err) {
        notify("error", err instanceof Error ? `Tagging failed: ${err.message}` : "Tagging failed.");
      } finally {
        setAnalyzing((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [notify],
  );

  const patchUpload = (id: string, patch: Partial<UploadState>) =>
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  const dropUpload = (id: string, after = 0) =>
    setTimeout(() => setUploads((list) => list.filter((u) => u.id !== id)), after);

  const handleFiles = useCallback(
    async (picked: File[]) => {
      for (const file of picked) {
        const problem = checkUpload(file.name, file.size);
        if (problem) {
          notify("error", `${file.name}: ${problem}`);
          continue;
        }

        const id = uid();
        setUploads((list) => [...list, { id, name: file.name, progress: 0, phase: "uploading" }]);
        try {
          const key = await uploadFile(file, (progress) => patchUpload(id, { progress }));
          patchUpload(id, { phase: "tagging", progress: 100 });
          await refresh(); // show the new file straight away
          await runAnalyze(key); // then fill in its tags
          patchUpload(id, { phase: "done" });
          dropUpload(id, 2000);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed.";
          patchUpload(id, { phase: "error", error: message });
          dropUpload(id, 9000);
        }
      }
    },
    [notify, refresh, runAnalyze],
  );

  const handleOpen = useCallback(
    async (file: FileItem) => {
      // Open the tab first, inside the click, so pop-up blockers allow it. Point it at S3 once the link is ready.
      const tab = window.open("about:blank", "_blank");
      try {
        const url = await getDownloadUrl(file.key);
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch (err) {
        tab?.close();
        notify("error", err instanceof Error ? err.message : "Could not open the file.");
      }
    },
    [notify],
  );

  const handleDelete = useCallback(
    async (file: FileItem) => {
      try {
        await deleteFile(file.key);
        setFiles((prev) => prev.filter((f) => f.key !== file.key));
        notify("success", `Deleted ${file.name}`);
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Could not delete the file.");
      }
    },
    [notify],
  );

  const handleToggleStar = useCallback(
    async (file: FileItem) => {
      const next = !file.starred;
      const setStar = (starred: boolean) =>
        setFiles((prev) => prev.map((f) => (f.key === file.key ? { ...f, starred } : f)));
      setStar(next); // change the screen straight away, undo if the server says no
      try {
        await starFile(file.key, next);
      } catch (err) {
        setStar(!next);
        notify("error", err instanceof Error ? err.message : "Could not update the star.");
      }
    },
    [notify],
  );

  const handleShare = useCallback(
    async (file: FileItem, minutes: number) => {
      try {
        const { url, label } = await shareFile(file.key, minutes);
        try {
          await navigator.clipboard.writeText(url);
          notify("success", `Link copied. Anyone with it can open ${file.name} for ${label}.`);
        } catch {
          // Some browsers block clipboard access. Show the link so it can still be copied by hand.
          window.prompt(`Copy this link. It works for ${label}.`, url);
        }
      } catch (err) {
        notify("error", err instanceof Error ? err.message : "Could not create the share link.");
      }
    },
    [notify],
  );

  const counts = useMemo(() => {
    const c: Record<View, number> = { All: files.length, Starred: 0, Images: 0, PDFs: 0, Documents: 0, Other: 0 };
    for (const f of files) {
      c[f.category]++;
      if (f.starred) c.Starred++;
    }
    return c;
  }, [files]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = files.filter((f) => {
      if (view === "Starred" && !f.starred) return false;
      if (view !== "All" && view !== "Starred" && f.category !== view) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        (f.summary?.toLowerCase().includes(q) ?? false) ||
        f.tags.some((t) => t.includes(q))
      );
    });
    return sortFiles(matching, sort);
  }, [files, view, query, sort]);

  const totalSize = useMemo(() => files.reduce((sum, f) => sum + f.size, 0), [files]);
  const title = view === "All" ? "All files" : view;
  const vaultIsEmpty = !loading && files.length === 0;

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <Sidebar
        view={view}
        counts={counts}
        onSelect={setView}
        user={user}
        region={region}
        onSignOut={() => signOut({ callbackUrl: "/" })}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <main className="page-glow min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/85 px-4 py-3 backdrop-blur sm:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-ink-soft hover:bg-slate-soft md:hidden"
          >
            <Icon name="menu" />
          </button>
          <div className="relative w-full max-w-md">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, tag or summary"
              aria-label="Search files"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm placeholder:text-muted focus:border-teal focus:outline-none"
            />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-9 px-4 pb-24 pt-9 sm:px-8">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
            <p className="mt-2 text-sm text-muted">
              {files.length === 0
                ? "Nothing stored yet"
                : `${files.length} ${files.length === 1 ? "file" : "files"} · ${formatBytes(totalSize)} used`}
            </p>
          </div>

          {files.length > 0 && <StatsStrip files={files} />}

          <AskVault files={files} loading={loading} onOpen={handleOpen} />

          <UploadZone onFiles={handleFiles} uploads={uploads} />

          <section aria-label={title}>
            {loading ? (
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface" aria-busy="true">
                {[0, 1, 2, 3].map((i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-5">
                    <div className="h-11 w-11 rounded-xl bg-slate-soft motion-safe:animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-1/3 rounded bg-slate-soft motion-safe:animate-pulse" />
                      <div className="h-3 w-2/3 rounded bg-slate-soft motion-safe:animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : vaultIsEmpty ? (
              <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
                <svg viewBox="0 0 120 90" className="h-24 w-32 text-accent" fill="none" aria-hidden="true">
                  <path
                    d="M34 66a16 16 0 0 1-2.4-31.8A24 24 0 0 1 78 28a18 18 0 0 1-2 38z"
                    fill="var(--teal-soft)"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <rect x="46" y="40" width="28" height="34" rx="4" fill="var(--surface)" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M52 52h16M52 59h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <path d="M95 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="var(--amber-ink)" />
                </svg>
                <p className="mt-4 font-display text-3xl">Your vault is empty</p>
                <p className="mt-2 max-w-sm text-sm text-muted">
                  Drop a file in the box above. It's stored in your S3 bucket, and the AI adds a summary and tags in a few seconds.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted">
                    {visible.length} {visible.length === 1 ? "file" : "files"}
                    {query.trim() ? ` matching “${query.trim()}”` : ""}
                  </p>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    Sort
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as Sort)}
                      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-teal focus:outline-none"
                    >
                      {SORTS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {visible.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
                    <p className="font-medium">
                      {view === "Starred" && !query.trim()
                        ? "No starred files yet"
                        : `No files match${query.trim() ? ` “${query.trim()}”` : " this view"}`}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {view === "Starred" && !query.trim()
                        ? "Tap the star on a file to keep it here."
                        : "Try a different word, or look at all files."}
                    </p>
                    <button
                      onClick={() => {
                        setQuery("");
                        setView("All");
                      }}
                      className="mt-3 text-sm font-medium text-accent hover:underline"
                    >
                      Show all files
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/5">
                    {visible.map((file) => (
                      <FileRow
                        key={file.key}
                        file={file}
                        analyzing={analyzing.has(file.key)}
                        onOpen={handleOpen}
                        onDelete={handleDelete}
                        onAnalyze={(f) => runAnalyze(f.key)}
                        onToggleStar={handleToggleStar}
                        onShare={handleShare}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
