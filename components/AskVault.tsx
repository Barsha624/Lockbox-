"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { askVault } from "../lib/client";
import type { AskResult, FileItem } from "../lib/types";

const SUGGESTIONS = ["What is in my vault?", "Which files are PDFs?", "Show my newest uploads"];

interface Props {
  files: FileItem[];
  loading: boolean;
  onOpen: (file: FileItem) => void;
}

export default function AskVault({ files, loading: filesLoading, onOpen }: Props) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasFiles = files.length > 0;
  const canAsk = hasFiles && !filesLoading;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || thinking || !canAsk) return;
    setThinking(true);
    setError(null);
    setAsked(q);
    try {
      setResult(await askVault(q));
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setThinking(false);
    }
  }

  // Match the answer's file keys to the current file list (a file deleted since then is skipped).
  const matches = result
    ? result.fileKeys.map((k) => files.find((f) => f.key === k)).filter((f): f is FileItem => !!f)
    : [];

  return (
    <section id="ask-vault" aria-label="Ask your vault" className="ask-bg rounded-2xl p-5 text-white shadow-lg shadow-black/10 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-300">
          <Icon name="sparkle" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-3xl leading-tight">Ask your vault</h2>
          <p className="mt-1 text-sm text-white/65">Ask a question and get an answer from your own files.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="mt-5 flex flex-col gap-2 sm:flex-row"
      >
        <input
          id="ask-vault-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={!canAsk}
          maxLength={500}
          aria-label="Your question"
          placeholder={canAsk ? "For example: which file has my invoice?" : "Upload a file first, then ask about it"}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-white/50 focus:border-teal-300 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canAsk || thinking || question.trim().length === 0}
          className="rounded-xl bg-white px-6 py-3 text-sm font-medium text-deep transition hover:bg-teal-soft disabled:opacity-50"
        >
          {thinking ? "Asking…" : "Ask"}
        </button>
      </form>

      {canAsk && !result && !thinking && !error && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
          {SUGGESTIONS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => {
                  setQuestion(s);
                  ask(s);
                }}
                className="rounded-full border border-white/20 px-3.5 py-1.5 text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div aria-live="polite">
        {thinking && <p className="mt-5 text-sm text-white/65 motion-safe:animate-pulse">Looking through your files…</p>}

        {error && (
          <p role="alert" className="mt-5 text-sm text-rose-200">
            {error}
          </p>
        )}

        {result && !thinking && (
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-sm text-white/55">You asked: {asked}</p>
            <p className="mt-2 text-base leading-relaxed">{result.answer}</p>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${
                result.source === "ai" ? "bg-amber-soft text-amber-ink" : "bg-white/10 text-white/70"
              }`}
            >
              {result.source === "ai" && <Icon name="sparkle" className="h-3 w-3" />}
              {result.source === "ai" ? "Answered by AI from your file summaries" : "Keyword match, not AI"}
            </span>

            {matches.length > 0 && (
              <ul className="mt-4 space-y-2">
                {matches.map((f) => (
                  <li key={f.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5">
                    <span className="truncate text-sm" title={f.name}>
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpen(f)}
                      className="shrink-0 rounded-lg bg-white/15 px-3 py-1 text-sm transition hover:bg-white/25"
                    >
                      {f.category === "Images" || f.category === "PDFs" ? "Open" : "Download"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
