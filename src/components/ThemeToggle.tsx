"use client";
import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ta-theme");
      if (saved === "light" || saved === "dark") setMode(saved);
    } catch {}
  }, []);

  function apply(next: Mode) {
    setMode(next);
    try {
      if (next === "system") {
        localStorage.removeItem("ta-theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("ta-theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {}
  }

  const opts: { key: Mode; label: string }[] = [
    { key: "light", label: "Light" },
    { key: "system", label: "Auto" },
    { key: "dark", label: "Dark" },
  ];

  return (
    <div
      role="group"
      aria-label="Colour theme"
      style={{
        display: "inline-flex",
        border: "1px solid var(--line)",
        borderRadius: 7,
        overflow: "hidden",
        background: "var(--paper)",
      }}
    >
      {opts.map((o) => (
        <button
          key={o.key}
          onClick={() => apply(o.key)}
          aria-pressed={mode === o.key}
          style={{
            border: 0,
            padding: "6px 11px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: mode === o.key ? "var(--coral)" : "transparent",
            color: mode === o.key ? "#fff" : "var(--muted)",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
