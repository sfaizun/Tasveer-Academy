"use client";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { createAnnouncement, decideAnnouncementRequest, unpublishAnnouncement } from "./actions";
import { fmtDhaka, targetLabel } from "./shared";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type ClassGroup = { id: string; batch_name: string; subject?: { name: string; level: string | null } | null };
type ClassLevel = { id: string; name: string; programme?: { code: string; name: string } | null };

function groupLabel(g: ClassGroup) {
  const level = g.subject?.level ? ` (${g.subject.level.toUpperCase()})` : "";
  return `${g.subject?.name ?? ""}${level} — Batch ${g.batch_name}`;
}
function levelLabel(l: ClassLevel) {
  return `${l.programme?.name ?? ""} — ${l.name}`;
}

function StatusChip({ status }: { status: string }) {
  if (status === "published") return <span className="st paid"><span className="dot" />Live</span>;
  if (status === "declined") return <span className="st over"><span className="dot" />Declined</span>;
  if (status === "unpublished") return <span className="st past"><span className="dot" />Taken down</span>;
  if (status === "pending_review") return <span className="st due"><span className="dot" />Pending</span>;
  return <span className="st due"><span className="dot" />{status}</span>;
}

function CreateForm({ classGroups, classLevels }: { classGroups: ClassGroup[]; classLevels: ClassLevel[] }) {
  const [state, action, pending] = useActionState(createAnnouncement, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [targetType, setTargetType] = useState<"academy" | "class_group" | "class_level">("academy");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setTargetType("academy");
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="field">
        <label className="lbl">Title<Req /></label>
        <input style={inputStyle} type="text" name="title" required />
      </div>
      <div className="field">
        <label className="lbl">Message<Req /></label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} name="body" required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Audience<Req /></label>
          <select style={inputStyle} name="target_type" value={targetType} onChange={(e) => setTargetType(e.target.value as any)}>
            <option value="academy">Whole academy</option>
            <option value="class_group">One subject class (O/A Level)</option>
            <option value="class_level">One junior class</option>
          </select>
        </div>
        {targetType === "class_group" && (
          <div className="field">
            <label className="lbl">Class<Req /></label>
            <select style={inputStyle} name="class_group_id" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {classGroups.map((g) => (
                <option key={g.id} value={g.id}>{groupLabel(g)}</option>
              ))}
            </select>
          </div>
        )}
        {targetType === "class_level" && (
          <div className="field">
            <label className="lbl">Junior class<Req /></label>
            <select style={inputStyle} name="class_level_id" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {classLevels.map((l) => (
                <option key={l.id} value={l.id}>{levelLabel(l)}</option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label className="lbl">Urgency</label>
          <select style={inputStyle} name="urgency" defaultValue="normal">
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="field">
          <label className="lbl">Visible until (optional)</label>
          <input style={inputStyle} type="datetime-local" name="expires_at" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Publishing…" : "Publish now"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Published.</span>}
      </div>
    </form>
  );
}

function DecideForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(decideAnnouncementRequest, null);
  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <input style={{ ...inputStyle, minWidth: 200, flex: "1 1 200px" }} type="text" name="note" placeholder="Note (required to decline)" />
      <button className="btn" type="submit" name="decision" value="approve" disabled={pending} style={{ fontSize: 12, padding: "8px 12px" }}>
        Approve
      </button>
      <button className="btn ghost" type="submit" name="decision" value="decline" disabled={pending} style={{ fontSize: 12, padding: "8px 12px", color: "var(--crit)" }}>
        Decline
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

export default function AdminAnnouncements({
  pending,
  recent,
  classGroups,
  classLevels,
}: {
  pending: any[];
  recent: any[];
  classGroups: ClassGroup[];
  classLevels: ClassLevel[];
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="panel">
        <div className="phead">
          <div className="ptitle">New announcement</div>
          <div className="sub">Goes live immediately</div>
        </div>
        <div style={{ padding: 16 }}>
          <CreateForm classGroups={classGroups} classLevels={classLevels} />
        </div>
      </div>

      {pending.length > 0 && (
        <div className="panel" style={{ borderLeft: "3px solid var(--blue)" }}>
          <div className="phead">
            <div className="ptitle">Teacher requests waiting for review</div>
            <div className="sub">{pending.length} pending</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {pending.map((r) => (
              <div key={r.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--line2)" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                  <b style={{ color: "var(--ink)" }}>{r.title}</b>
                  <span className="sub">{targetLabel((r.announcement_target ?? [])[0] ?? null, r.scope)}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginBottom: 6 }}>{r.body}</div>
                <div className="sub" style={{ marginBottom: 10 }}>
                  Requested window: {fmtDhaka(r.publish_at)} – {fmtDhaka(r.expires_at)}
                </div>
                <DecideForm id={r.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Recent</div>
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Audience</th>
                <th>Status</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => {
                const isOpen = open === a.id;
                return (
                  <Fragment key={a.id}>
                    <tr>
                      <td><b>{a.title}</b></td>
                      <td className="sub">{targetLabel((a.announcement_target ?? [])[0] ?? null, a.scope)}</td>
                      <td><StatusChip status={a.status} /></td>
                      <td className="n">
                        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(isOpen ? null : a.id)}>
                          {isOpen ? "Close" : "View"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={4} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                          <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginBottom: 8 }}>{a.body}</div>
                          <div className="sub" style={{ marginBottom: 10 }}>
                            {a.published_at ? `Published ${fmtDhaka(a.published_at)}` : "Not yet published"}
                            {a.expires_at ? ` · visible until ${fmtDhaka(a.expires_at)}` : ""}
                            {a.decision_note ? ` · note: “${a.decision_note}”` : ""}
                          </div>
                          {a.status === "published" && (
                            <form action={unpublishAnnouncement}>
                              <input type="hidden" name="id" value={a.id} />
                              <button className="btn ghost" type="submit" style={{ fontSize: 12, color: "var(--crit)" }}>
                                Take down
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {recent.length === 0 && (
                <tr><td colSpan={4} className="sub">Nothing here yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
