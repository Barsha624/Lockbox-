"use client";

import { Icon, type IconName } from "./Icon";
import { formatBytes } from "../lib/format";
import { CATEGORIES, type Category } from "../lib/types";

const METER_COLOR: Record<Category, string> = {
  Images: "var(--chart-images)",
  PDFs: "var(--chart-pdfs)",
  Documents: "var(--chart-docs)",
  Other: "var(--chart-other)",
};

export type View = "All" | "Starred" | Category;

const LABELS: Record<View, { label: string; icon: IconName }> = {
  All: { label: "All files", icon: "folder" },
  Starred: { label: "Starred", icon: "star" },
  Images: { label: "Images", icon: "image" },
  PDFs: { label: "PDFs", icon: "file" },
  Documents: { label: "Documents", icon: "text" },
  Other: { label: "Other", icon: "archive" },
};

interface Props {
  view: View;
  counts: Record<View, number>;
  onSelect: (view: View) => void;
  user: { name?: string | null; email?: string | null; image?: string | null };
  region: string;
  usage: { total: number; byCategory: Record<Category, number> };
  onSignOut: () => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ view, counts, onSelect, user, region, usage, onSignOut, open, onClose }: Props) {
  const initials = (user.name || user.email || "?").slice(0, 2).toUpperCase();

  return (
    <>
      {/* Dark overlay behind the drawer on phones */}
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 sidebar-bg flex w-72 flex-col justify-between px-5 py-6 text-white transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-64 md:translate-x-0 md:shrink-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <div className="mb-8 flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal">
                <Icon name="cloud" className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold tracking-tight">Lockbox</span>
            </div>
            <button onClick={onClose} aria-label="Close menu" className="rounded p-1 text-white/70 hover:text-white md:hidden">
              <Icon name="close" />
            </button>
          </div>

          <nav aria-label="File types" className="space-y-1">
            {(["All", "Starred", ...CATEGORIES] as View[]).map((v) => {
              const active = v === view;
              return (
                <button
                  key={v}
                  onClick={() => {
                    onSelect(v);
                    onClose();
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    active ? "bg-white/10 font-medium text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon name={LABELS[v].icon} className={`h-[18px] w-[18px] ${active ? "text-teal-300" : ""}`} />
                  <span className="flex-1">{LABELS[v].label}</span>
                  <span className={`text-xs tabular-nums ${active ? "text-white/80" : "text-white/40"}`}>{counts[v]}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">Storage</p>
              <p className="text-xs text-white/60">{formatBytes(usage.total)} used</p>
            </div>
            <div
              role="img"
              aria-label={`Storage by type: ${CATEGORIES.filter((c) => usage.byCategory[c] > 0)
                .map((c) => `${c} ${formatBytes(usage.byCategory[c])}`)
                .join(", ") || "empty"}`}
              className="mt-2.5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/10"
            >
              {CATEGORIES.filter((c) => usage.byCategory[c] > 0).map((c) => (
                <span
                  key={c}
                  className="rounded-full"
                  style={{ flexGrow: usage.byCategory[c], flexBasis: 0, minWidth: 4, backgroundColor: METER_COLOR[c] }}
                />
              ))}
            </div>
            {region && <p className="mt-2 text-xs text-white/45">Stored in AWS {region}</p>}
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="flex items-center gap-3">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal text-xs font-semibold">
                  {initials}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user.name || "Signed in"}</p>
                <p className="truncate text-xs text-white/55">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm text-white/90 transition hover:bg-white/15"
            >
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
