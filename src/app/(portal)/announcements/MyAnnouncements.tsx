import { fmtDhaka, isCurrentlyVisible, targetLabel } from "./shared";
import { acknowledgeAnnouncement } from "./actions";

function UrgencyChip({ urgency }: { urgency: string }) {
  if (urgency === "urgent") return <span className="st over"><span className="dot" />Urgent</span>;
  return <span className="st due"><span className="dot" />Notice</span>;
}

export default function MyAnnouncements({
  announcements,
  acknowledgedIds,
}: {
  announcements: any[];
  /** Ids of announcements the signed-in student/guardian has already acknowledged —
   * omit (or pass undefined) when acknowledgment tracking doesn't apply, e.g. no
   * student link was found for this account. */
  acknowledgedIds?: Set<string>;
}) {
  const visible = announcements.filter((a) => isCurrentlyVisible(a.publish_at, a.expires_at));

  const groups = new Map<string, { label: string; rows: any[] }>();
  for (const a of visible) {
    const t = (a.announcement_target ?? [])[0] ?? null;
    const label = targetLabel(t, a.scope);
    if (!groups.has(label)) groups.set(label, { label, rows: [] });
    groups.get(label)!.rows.push(a);
  }
  // Academy-wide first, then alphabetical by class.
  const ordered = [...groups.values()].sort((x, y) => {
    if (x.label === "Whole academy") return -1;
    if (y.label === "Whole academy") return 1;
    return x.label.localeCompare(y.label);
  });

  if (ordered.length === 0) {
    return (
      <div className="panel" style={{ padding: 18 }}>
        <div className="sub">No announcements right now — check back later.</div>
      </div>
    );
  }

  return (
    <>
      {ordered.map((g) => (
        <div className="panel" key={g.label}>
          <div className="phead">
            <div className="ptitle">{g.label}</div>
            <div className="sub">{g.rows.length} announcement{g.rows.length === 1 ? "" : "s"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {g.rows.map((a) => (
              <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--line2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <b style={{ color: "var(--ink)" }}>{a.title}</b>
                  <UrgencyChip urgency={a.urgency} />
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginBottom: 6 }}>{a.body}</div>
                {(a.announcement_attachment ?? [])[0]?.file_path && (
                  <img
                    src={(a.announcement_attachment ?? [])[0].file_path}
                    alt=""
                    style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 8, display: "block", marginBottom: 8 }}
                  />
                )}
                <div className="sub">
                  Posted {fmtDhaka(a.published_at)}
                  {a.expires_at ? ` · visible until ${fmtDhaka(a.expires_at)}` : ""}
                </div>
                {a.requires_ack && (
                  acknowledgedIds?.has(a.id) ? (
                    <div style={{ marginTop: 8 }}>
                      <span className="st paid"><span className="dot" />Acknowledged</span>
                    </div>
                  ) : (
                    <form action={acknowledgeAnnouncement} style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="btn" type="submit" style={{ fontSize: 12, padding: "6px 12px" }}>
                        I&apos;ve read this — Acknowledge
                      </button>
                    </form>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
