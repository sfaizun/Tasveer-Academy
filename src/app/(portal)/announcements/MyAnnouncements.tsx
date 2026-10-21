import { feedOf, fmtDhaka, targetLabel } from "./shared";
import { acknowledgeAnnouncement } from "./actions";

/** Status tag, same look as Active on a student's subjects: green "Active" while the
 * announcement is live (published and inside its visible dates), grey "Inactive" once its time
 * has passed. A live urgent one also gets a red "Urgent" tag. */
function StatusChip({ urgency, live }: { urgency: string; live: boolean }) {
  return (
    <>
      {live
        ? <span className="st paid"><span className="dot" />Active</span>
        : <span className="st due"><span className="dot" />Inactive</span>}
      {live && urgency === "urgent" && <span className="st over"><span className="dot" />Urgent</span>}
    </>
  );
}

/** Announcements for a student, guardian or teacher, newest first. Ones whose visible-until time
 * has passed stay listed (marked ended). `pastLimit` keeps only that many ended ones (dashboard). */
export default function MyAnnouncements({
  announcements,
  acknowledgedIds,
  pastLimit,
}: {
  announcements: any[];
  /** Ids of announcements the signed-in student/guardian has already acknowledged —
   * omit (or pass undefined) when acknowledgment tracking doesn't apply, e.g. no
   * student link was found for this account. */
  acknowledgedIds?: Set<string>;
  pastLimit?: number;
}) {
  const { list, total } = feedOf(announcements, pastLimit);
  const hidden = total - list.length;

  if (list.length === 0) {
    return (
      <div className="panel" style={{ padding: 18 }}>
        <div className="sub">No announcements yet.</div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((a) => (
          <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--line2)" }}>
            <div className="lbl" style={{ fontSize: 10, marginBottom: 4 }}>{targetLabel((a.announcement_target ?? [])[0] ?? null, a.scope)}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <b style={{ color: "var(--ink)" }}>{a.title}</b>
              <StatusChip urgency={a.urgency} live={a.live} />
            </div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginBottom: 6 }}>{a.body}</div>
            {(a.announcement_attachment ?? [])[0]?.file_path && (
              <img
                src={(a.announcement_attachment ?? [])[0].file_path}
                alt=""
                style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 8, display: "block", marginBottom: 8 }}
              />
            )}
            <div className="sub" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <span>
                Posted {fmtDhaka(a.published_at)}
                {a.expires_at ? ` · ${a.live ? "visible until" : "ended"} ${fmtDhaka(a.expires_at)}` : ""}
              </span>
              <a href={`/announcements/${a.id}?print=1`} target="_blank" rel="noopener" style={{ fontSize: 12 }}>Print</a>
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
                    I&apos;ve read this, acknowledge
                  </button>
                </form>
              )
            )}
          </div>
        ))}
      </div>
      {hidden > 0 && (
        <div style={{ padding: "12px 16px" }}>
          <a href="/announcements" style={{ fontSize: 13 }}>See all announcements ({total})</a>
        </div>
      )}
    </div>
  );
}
