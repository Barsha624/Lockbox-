"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/** Switches between the light and dark theme and remembers the choice in this browser. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  // The page script has already set data-theme before first paint; read it once we're in the browser.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("cv-theme", next);
    } catch {
      // Private mode can block storage. The theme still changes for this visit.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      className="rounded-xl border border-line bg-surface p-2.5 text-ink-soft transition hover:border-teal hover:text-accent"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="h-[18px] w-[18px]" />
    </button>
  );
}
