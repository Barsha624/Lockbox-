"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import AskVault from "./AskVault";
import FileCard from "./FileCard";
import FileRow from "./FileRow";
import { Icon } from "./Icon";
import PreviewModal from "./PreviewModal";
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
  getThumbUrls,
  shareFile,
  starFile,
  uploadFile,
} from "../lib/client";
import { formatBytes, formatDate } from "../lib/format";
import { ACCEPT_ATTRIBUTE, checkUpload, type Category, type FileItem } from "../lib/types";

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Sort = "newest" | "oldest" | "name" | "size";
const SORTS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A to Z" },
  { value: "size", label: "Largest first" },
];

const THUMB_MAX_BYTES = 6 * 1024 * 1024; // bigger pictures keep the plain tile, so the page stays light
const THUMB_REFRESH_MS = 10 * 60 * 1000; // picture links last 15 minutes, so renew them before that
const CHIPS: View[] = ["All", "Images", "PDFs", "Documents", "Other"];
type Layout = "grid" | "list";

const isPreviewable = (f: FileItem) => f.category === "Images" || f.category === "PDFs";

function greetingFor(name?: string | null): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : part;
}

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
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<Layout>("grid");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [thumbEpoch, setThumbEpoch] = useState(0);
  const requestedThumbs = useRef<Set<string>>(new Set());

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

  const toggleSelect = useCallback((file: FileItem) => {
    setBulkConfirm(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(file.key)) next.delete(file.key);
      else next.add(file.key);
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const targets = files.filter((f) => selected.has(f.key));
    setBulkBusy(true);
    const gone = new Set<string>();
    for (const f of targets) {
      try {
        await deleteFile(f.key);
        gone.add(f.key);
      } catch {
        // counted below
      }
    }
    setFiles((prev) => prev.filter((f) => !gone.has(f.key)));
    setSelected(new Set());
    setBulkConfirm(false);
    setBulkBusy(false);
    const failed = targets.length - gone.size;
    if (failed > 0) notify("error", `Deleted ${gone.size}, but ${failed} could not be deleted. Try those again.`);
    else notify("success", `Deleted ${gone.size} ${gone.size === 1 ? "file" : "files"}`);
  }, [files, selected, notify]);

  // Remember grid or list between visits (private windows may block storage, so never rely on it).
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cv-layout");
      if (saved === "grid" || saved === "list") setLayout(saved);
    } catch {
      /* storage unavailable: keep the default */
    }
  }, []);
  const chooseLayout = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem("cv-layout", next);
    } catch {
      /* ignore */
    }
  };

  // Picture links for image cards. Each key is requested once; a timer renews them before they expire.
  useEffect(() => {
    const keys = files
      .filter((f) => f.category === "Images" && f.size <= THUMB_MAX_BYTES && !requestedThumbs.current.has(f.key))
      .map((f) => f.key);
    if (keys.length === 0) return;
    keys.forEach((k) => requestedThumbs.current.add(k));
    (async () => {
      for (let i = 0; i < keys.length; i += 40) {
        try {
          const urls = await getThumbUrls(keys.slice(i, i + 40));
          setThumbs((prev) => ({ ...prev, ...urls }));
        } catch {
          // Cards fall back to the plain tile if pictures can't be loaded.
        }
      }
    })();
  }, [files, thumbEpoch]);
  useEffect(() => {
    const timer = setInterval(() => {
      requestedThumbs.current.clear();
      setThumbEpoch((e) => e + 1);
    }, THUMB_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  // Press "/" anywhere to jump to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Drop files anywhere on the page. The upload box handles its own drops (it calls preventDefault first).
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (e.defaultPrevented || !hasFiles(e)) return;
      e.preventDefault();
      const dropped = Array.from(e.dataTransfer?.files ?? []);
      if (dropped.length > 0) handleFiles(dropped);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [handleFiles]);

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

  const previewList = useMemo(() => visible.filter(isPreviewable), [visible]);
  const previewIndex = previewKey ? previewList.findIndex((f) => f.key === previewKey) : -1;
  const previewFile = previewIndex >= 0 ? previewList[previewIndex] : null;

  const handlePreview = useCallback(
    (file: FileItem) => {
      if (isPreviewable(file)) setPreviewKey(file.key);
      else handleOpen(file); // Word, Excel, zip and so on can't be shown in the page, so download them
    },
    [handleOpen],
  );
  const closePreview = useCallback(() => setPreviewKey(null), []);
  const stepPreview = useCallback(
    (delta: number) => {
      if (previewList.length === 0 || previewIndex < 0) return;
      setPreviewKey(previewList[(previewIndex + delta + previewList.length) % previewList.length].key);
    },
    [previewList, previewIndex],
  );
  const prevPreview = useCallback(() => stepPreview(-1), [stepPreview]);
  const nextPreview = useCallback(() => stepPreview(1), [stepPreview]);

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.key)), [files, selected]);
  const allVisibleSelected = visible.length > 0 && visible.every((f) => selected.has(f.key));
  const toggleAllVisible = () => {
    setBulkConfirm(false);
    setSelected(allVisibleSelected ? new Set() : new Set(visible.map((f) => f.key)));
  };
  const usage = useMemo(() => {
    const byCategory: Record<Category, number> = { Images: 0, PDFs: 0, Documents: 0, Other: 0 };
    for (const f of files) byCategory[f.category] += f.size;
    return { total: files.reduce((sum, f) => sum + f.size, 0), byCategory };
  }, [files]);
  const recent = useMemo(() => sortFiles(files, "newest").slice(0, 4), [files]);
  const newest = recent[0] ?? null;
  const greeting = useMemo(() => greetingFor(user.name), [user.name]);

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
        usage={usage}
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
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, tag or summary"
              aria-label="Search files"
              className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-4 text-sm transition-shadow placeholder:text-muted focus:border-teal focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)] focus:outline-none"
            />
            {!query && (
              <kbd
                aria-hidden="true"
                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line px-1.5 py-0.5 font-sans text-xs text-muted sm:block"
              >
                /
              </kbd>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                document.getElementById("ask-vault")?.scrollIntoView({ behavior: "smooth", block: "center" });
                document.getElementById("ask-vault-input")?.focus({ preventScroll: true });
              }}
              aria-label="Ask AI about your files"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium transition hover:border-teal hover:text-accent active:scale-95"
            >
              <Icon name="sparkle" className="h-4 w-4 text-amber-ink" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              aria-label="Upload files"
              className="inline-flex items-center gap-2 rounded-xl bg-teal px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-teal/30 transition hover:opacity-90 active:scale-95"
            >
              <Icon name="upload" className="h-4 w-4" />
              <span className="hidden sm:inline">Upload</span>
            </button>
            <input
              ref={uploadRef}
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              tabIndex={-1}
              aria-hidden="true"
              className="sr-only"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                if (picked.length > 0) handleFiles(picked);
                e.target.value = ""; // lets you pick the same file again
              }}
            />
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-9 px-4 pb-24 pt-9 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl sm:text-5xl">{view === "All" ? greeting : title}</h1>
              <p className="mt-2 text-sm text-muted">
                {files.length === 0
                  ? "Nothing stored yet. Your first file is one drop away."
                  : `${files.length} ${files.length === 1 ? "file" : "files"} · ${formatBytes(totalSize)} used${
                      newest ? ` · last upload ${formatDate(newest.lastModified)}` : ""
                    }`}
              </p>
            </div>
            {files.length > 0 && (
              <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2 text-sm">
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setView(c)}
                    aria-pressed={view === c}
                    className={`rounded-full px-4 py-1.5 transition active:scale-95 ${
                      view === c ? "bg-ink text-paper" : "border border-line bg-surface text-ink-soft hover:border-teal hover:text-accent"
                    }`}
                  >
                    {c === "All" ? "All" : c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {files.length > 0 && <StatsStrip files={files} />}

          <AskVault files={files} loading={loading} onOpen={handleOpen} />

          <UploadZone onFiles={handleFiles} uploads={uploads} />

          {!loading && view === "All" && !query.trim() && files.length >= 6 && (
            <section aria-label="Recently added">
              <h2 className="mb-3 font-display text-3xl">Recently added</h2>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {recent.map((file, i) => (
                  <FileCard
                    key={`recent-${file.key}`}
                    file={file}
                    index={i}
                    thumbUrl={thumbs[file.key]}
                    analyzing={analyzing.has(file.key)}
                    selected={selected.has(file.key)}
                    onSelect={toggleSelect}
                    onPreview={handlePreview}
                    onOpen={handleOpen}
                    onDelete={handleDelete}
                    onAnalyze={(f) => runAnalyze(f.key)}
                    onToggleStar={handleToggleStar}
                    onShare={handleShare}
                  />
                ))}
              </ul>
            </section>
          )}

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
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      disabled={visible.length === 0}
                      aria-label="Select all files shown"
                      className="h-4 w-4 cursor-pointer accent-teal"
                    />
                    <span>
                      {visible.length} {visible.length === 1 ? "file" : "files"}
                      {query.trim() ? ` matching “${query.trim()}”` : ""}
                    </span>
                  </label>
                  <div className="flex items-center gap-2">
                  <div role="group" aria-label="Layout" className="flex rounded-lg border border-line bg-surface p-0.5">
                    {(["grid", "list"] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => chooseLayout(l)}
                        aria-pressed={layout === l}
                        aria-label={l === "grid" ? "Grid view" : "List view"}
                        title={l === "grid" ? "Grid view" : "List view"}
                        className={`rounded-md p-1.5 transition ${layout === l ? "bg-slate-soft text-ink" : "text-muted hover:text-ink"}`}
                      >
                        <Icon name={l} className="h-[18px] w-[18px]" />
                      </button>
                    ))}
                  </div>
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
                  layout === "grid" ? (
                    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      {visible.map((file, i) => (
                        <FileCard
                          key={file.key}
                          file={file}
                          index={i}
                          thumbUrl={thumbs[file.key]}
                          analyzing={analyzing.has(file.key)}
                          selected={selected.has(file.key)}
                          onSelect={toggleSelect}
                          onPreview={handlePreview}
                          onOpen={handleOpen}
                          onDelete={handleDelete}
                          onAnalyze={(f) => runAnalyze(f.key)}
                          onToggleStar={handleToggleStar}
                          onShare={handleShare}
                        />
                      ))}
                    </ul>
                  ) : (
                    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm shadow-black/5">
                      {visible.map((file, i) => (
                        <FileRow
                          key={file.key}
                          index={i}
                          selected={selected.has(file.key)}
                          onSelect={toggleSelect}
                          onPreview={handlePreview}
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
                  )
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {selectedFiles.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
          <div
            role="region"
            aria-label="Selected files"
            className="modal-pop pointer-events-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-deep px-4 py-3 text-white shadow-xl shadow-black/30"
          >
            <span className="text-sm font-medium">{selectedFiles.length} selected</span>
            {bulkConfirm ? (
              <>
                <span className="text-sm text-white/80">Delete for good?</span>
                <button
                  onClick={() => setBulkConfirm(false)}
                  disabled={bulkBusy}
                  className="rounded-lg px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Keep
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="rounded-lg bg-danger-solid px-3.5 py-1.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                >
                  {bulkBusy ? "Deleting…" : `Delete ${selectedFiles.length}`}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg px-3 py-1.5 text-sm text-white/80 transition hover:bg-white/10"
                >
                  Clear
                </button>
                <button
                  onClick={() => setBulkConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3.5 py-1.5 text-sm font-medium transition hover:bg-white/25"
                >
                  <Icon name="trash" className="h-4 w-4" />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {dragging && (
        <div
          aria-hidden="true"
          className="modal-fade pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-deep/80 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-teal-soft/60 px-14 py-12 text-white">
            <Icon name="upload" className="h-12 w-12" />
            <p className="font-display text-3xl">Drop to add to your vault</p>
          </div>
        </div>
      )}

      {previewFile && (
        <PreviewModal
          file={previewFile}
          position={previewIndex + 1}
          total={previewList.length}
          onPrev={prevPreview}
          onNext={nextPreview}
          onClose={closePreview}
          onOpenTab={handleOpen}
        />
      )}

      <Toasts toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );
}
