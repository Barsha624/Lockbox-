"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Icon } from "./Icon";

const ERRORS: Record<string, string> = {
  OAuthSignin: "Google sign-in couldn't start. Check your Google client ID and secret.",
  OAuthCallback: "Google sign-in failed. Check that the redirect URI matches in Google Cloud Console.",
  AccessDenied: "Access was denied. Try again with a different Google account.",
  Configuration: "Sign-in isn't set up correctly. Check NEXTAUTH_SECRET and the Google keys in .env.local.",
};

const CREDENTIAL_ERRORS: Record<string, string> = {
  CredentialsSignin: "That email and password don't match.",
  TooManyAttempts: "Too many wrong tries. Wait 15 minutes, then try again.",
  ServerError: "Something went wrong on our side. Try again in a moment.",
};

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"form" | "google" | null>(null);
  const signingUp = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy("form");
    try {
      if (signingUp) {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Could not create the account.");
          setBusy(null);
          return;
        }
      }
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result || result.error) {
        setError(CREDENTIAL_ERRORS[result?.error ?? ""] ?? "Sign-in failed. Please try again.");
        setBusy(null);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setBusy(null);
    }
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(ERRORS[code] ?? "Sign-in failed. Please try again.");
  }, []);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <section className="login-bg relative flex flex-col justify-between overflow-hidden px-8 py-10 text-white sm:px-14 sm:py-14">
        <div className="relative flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal text-white shadow-lg shadow-black/30">
            <Icon name="cloud" className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Lockbox</span>
        </div>

        <div className="relative my-12 max-w-xl lg:my-8">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75">
            <Icon name="sparkle" className="h-3.5 w-3.5 text-amber-300" />
            AI-tagged storage on AWS S3
          </p>
          <h1 className="mt-5 font-display text-5xl leading-[1.05] sm:text-6xl">
            Your files, in a box <span className="text-teal-300">only you</span> can open.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">
            Upload documents, images and PDFs. Each one is read, summarised and tagged, so you can find it by what
            it contains, not just what you named it.
          </p>

          {/* An example of what the vault looks like. These files are made up for illustration. */}
          <div className="float-slow relative mt-9 hidden max-w-md lg:block" aria-hidden="true">
            <div className="rounded-2xl bg-white p-4 text-[#10242a] shadow-2xl shadow-black/40 ring-1 ring-white/20">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#fbe7e9] text-[#a4283a]">
                  <Icon name="file" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">march-electricity-invoice.pdf</p>
                  <p className="mt-0.5 text-xs text-[#5e7279]">March bill of 3,420 rupees, due on the 15th.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["invoice", "electricity", "finance"].map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[#fbf0d5] px-2.5 py-0.5 text-xs text-[#7a5200]">
                        <Icon name="sparkle" className="h-3 w-3" />
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-10 mt-3 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm shadow-xl shadow-black/30 backdrop-blur">
              <p className="text-white/55">You asked: which file has my bill?</p>
              <p className="mt-1.5 leading-snug">Your March electricity invoice, due on the 15th.</p>
            </div>
            <p className="mt-3 text-xs text-white/40">Example only</p>
          </div>
        </div>

        <ul className="relative grid gap-3 text-sm text-white/75 sm:grid-cols-3">
          {[
            ["sparkle", "AI summaries and tags"],
            ["search", "Ask questions about your files"],
            ["link", "Private, with expiring share links"],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-teal-300">
                <Icon name={icon as "sparkle" | "search" | "link"} className="h-4 w-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </section>

      <section className="page-glow flex items-center justify-center bg-paper px-6 py-14 sm:px-8">
        <div className="fade-up w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-xl shadow-black/5 sm:p-10">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-soft text-accent">
            <Icon name="cloud" className="h-6 w-6" />
          </span>
          <h2 className="mt-5 font-display text-4xl">{signingUp ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-2 text-ink-soft">
            {signingUp ? "It takes a few seconds. No email verification needed." : "Sign in to open your vault."}
          </p>

          <div role="tablist" aria-label="Sign in or create account" className="mt-6 grid grid-cols-2 rounded-xl bg-slate-soft p-1 text-sm font-medium">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`rounded-lg py-2 transition ${mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"}`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {signingUp && (
              <label className="block text-sm font-medium">
                Your name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  maxLength={60}
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal transition-shadow placeholder:text-muted focus:border-teal focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)] focus:outline-none"
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-4 py-3 font-normal transition-shadow placeholder:text-muted focus:border-teal focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)] focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <span className="relative mt-1.5 block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={signingUp ? "new-password" : "current-password"}
                  required
                  minLength={signingUp ? 8 : undefined}
                  maxLength={128}
                  className="w-full rounded-xl border border-line bg-surface py-3 pl-4 pr-16 font-normal transition-shadow placeholder:text-muted focus:border-teal focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--teal)_18%,transparent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-slate-soft"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
              {signingUp && <span className="mt-1.5 block text-xs font-normal text-muted">At least 8 characters.</span>}
            </label>

            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy !== null}
              className="w-full rounded-xl bg-teal px-5 py-3.5 font-medium text-white shadow-sm shadow-teal/30 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {busy === "form" ? (signingUp ? "Creating account…" : "Signing in…") : signingUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={() => {
              setBusy("google");
              signIn("google", { callbackUrl: "/" });
            }}
            disabled={busy !== null}
            className="lift flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 font-medium text-ink shadow-sm hover:border-teal/50 active:scale-[0.98] disabled:opacity-60"
          >
            <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </button>

          <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Icon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            Passwords are never stored, only a one-way scrambled version. Every account sees only its own files.
          </p>
        </div>
      </section>
    </div>
  );
}
