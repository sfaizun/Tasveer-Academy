"use client";

/** Shown when a save on a portal page fails without a form message of its own (for example a
 * remove or on/off switch the database refused). Nothing was changed. */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const viewOnly = /View only/i.test(error.message);
  return (
    <div className="content" style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
      <div className="panel" style={{ maxWidth: 520, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="ptitle">That change could not be saved</div>
        <div className="sub" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
          {viewOnly
            ? "You are viewing the portal as someone else, so changes are turned off. Stop viewing as them first."
            : "Nothing was changed. You may not have permission for it, or the connection dropped. Please try again; if it keeps happening, tell the office."}
        </div>
        {error.digest && <div className="sub mono" style={{ fontSize: 11 }}>Reference: {error.digest}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" type="button" onClick={() => reset()}>Try again</button>
          <button className="btn ghost" type="button" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    </div>
  );
}
