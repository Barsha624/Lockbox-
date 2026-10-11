import { formatBytes } from "../lib/format";
import { CATEGORIES, type Category, type FileItem } from "../lib/types";

// Fixed colour per file type (defined in globals.css, checked for colour-blind separation).
const CHART_COLOR: Record<Category, string> = {
  Images: "var(--chart-images)",
  PDFs: "var(--chart-pdfs)",
  Documents: "var(--chart-docs)",
  Other: "var(--chart-other)",
};

const RING_RADIUS = 30;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** One connected strip: storage used, files by type, and how many files the AI has tagged. */
export default function StatsStrip({ files }: { files: FileItem[] }) {
  const count = files.length;
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const largest = files.reduce<FileItem | null>((big, f) => (!big || f.size > big.size ? f : big), null);
  const byType = CATEGORIES.map((category) => ({ category, n: files.filter((f) => f.category === category).length })).filter(
    (t) => t.n > 0,
  );
  const aiTagged = files.filter((f) => f.analyzedBy === "ai").length;
  const percent = count === 0 ? 0 : Math.round((aiTagged / count) * 100);

  const chartSummary = `Files by type: ${byType.map((t) => `${t.n} ${t.category}`).join(", ")}`;

  return (
    <section
      aria-label="Vault summary"
      className="grid divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm shadow-black/5 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
    >
      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-medium text-muted">Storage used</h3>
        <p className="mt-2 font-display text-4xl leading-none">{formatBytes(totalBytes)}</p>
        <p className="mt-2 text-sm text-ink-soft">
          in {count} {count === 1 ? "file" : "files"}
        </p>
        {largest && (
          <p className="mt-1 truncate text-sm text-muted" title={largest.name}>
            Largest: {largest.name} ({formatBytes(largest.size)})
          </p>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-medium text-muted">File types</h3>
        {/* 2px gaps between segments are the chart surface showing through */}
        <div role="img" aria-label={chartSummary} className="mt-4 flex h-3 gap-0.5">
          {byType.map((t) => (
            <span
              key={t.category}
              className="rounded-[3px]"
              style={{ flexGrow: t.n, flexBasis: 0, minWidth: 6, backgroundColor: CHART_COLOR[t.category] }}
            />
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {byType.map((t) => (
            <li key={t.category} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: CHART_COLOR[t.category] }} />
              <span className="text-ink-soft">{t.category}</span>
              <span className="ml-auto tabular-nums text-ink">{t.n}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-5 p-5 sm:p-6">
        <div className="relative h-[76px] w-[76px] shrink-0">
          <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90" role="img" aria-label={`${percent}% of files tagged by AI`}>
            <circle cx="38" cy="38" r={RING_RADIUS} fill="none" strokeWidth="8" stroke="var(--slate-soft)" />
            <circle
              cx="38"
              cy="38"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              stroke="var(--accent)"
              strokeDasharray={`${(percent / 100) * RING_LENGTH} ${RING_LENGTH}`}
              style={{ transition: "stroke-dasharray 300ms ease" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-2xl">{percent}%</span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-muted">Tagged by AI</h3>
          <p className="mt-1 text-ink">
            {aiTagged} of {count} {count === 1 ? "file" : "files"}
          </p>
          {aiTagged === 0 && <p className="mt-1 text-sm text-muted">Set GEMINI_API_KEY to turn on AI tags.</p>}
        </div>
      </div>
    </section>
  );
}
