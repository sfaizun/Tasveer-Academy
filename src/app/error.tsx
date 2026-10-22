"use client";

/** Shown when a page can't load at all (for example the account lookup failed for a moment). */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="panel" style={{ padding: 28, maxWidth: 440, display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 19, margin: 0 }}>Something went wrong loading the page</h1>
        <p style={{ margin: 0, color: "var(--body)" }}>
          This is usually a brief connection problem. Please try again.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => { reset(); window.location.reload(); }}>Try again</button>
          <a className="btn ghost" href="/login">Sign in again</a>
        </div>
      </div>
    </main>
  );
}
