"use client";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { createAnnouncement, decideAnnouncementRequest, unpublishAnnouncement } from "./actions";
import { fmtDhaka, targetLabel } from "./shared";
import { groupSubjects, type SubjectForGrouping } from "@/lib/subjectGroups";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type Subject = SubjectForGrouping;
type TeacherSubject = { teacher_id: string; subject_id: string };
type Teacher = { id: string; full_name: string };
type ClassLevel = { id: string; name: string; programme?: { code: string; name: string } | null };

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

function CreateForm({
  subjects,
  classLevels,
  teachers,
  teacherSubjects,
}: {
  subjects: Subject[];
  classLevels: ClassLevel[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
}) {
  const [state, action, pending] = useActionState(createAnnouncement, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [targetType, setTargetType] = useState<"academy" | "class_group" | "class_level">("academy");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setTargetType("academy");
      setSubjectId("");
    }
  }, [state]);

  const subjectGroups = useMemo(() => groupSubjects(subjects), [subjects]);
  const eligibleTeachers = useMemo(() => {
    if (!subjectId) return [];
    const ids = new Set(teacherSubjects.filter((ts) => ts.subject_id === subjectId).map((ts) => ts.teacher_id));
    return teachers.filter((t) => ids.has(t.id));
  }, [subjectId, teacherSubjects, teachers]);

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
      <div className="field">
        <label className="lbl">Image (optional)</label>
        <input style={inputStyle} type="file" name="image" accept="image/*" />
        <div className="sub" style={{ marginTop: 4 }}>Up to 5 MB — JPEG, PNG, WebP, or GIF.</div>
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
          <>
            <div className="field">
              <label className="lbl">Subject<Req /></label>
              <select
                style={inputStyle}
                name="subject_id"
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="" disabled>Choose…</option>
                {subjectGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Teacher<Req /></label>
              <select key={subjectId} style={inputStyle} name="teacher_id" required defaultValue="" disabled={!subjectId}>
                <option value="" disabled>
                  {subjectId ? (eligibleTeachers.length ? "Choose…" : "No teacher mapped to this subject") : "Choose a subject first"}
                </option>
                {eligibleTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Batch</label>
              <input style={inputStyle} type="text" name="batch" placeholder="A" defaultValue="A" />
            </div>
          </>
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
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" name="requires_ack" value="1" />
        Require students to acknowledge they&apos;ve read this
      </label>
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
  const formRef = useRef<HTMLFormElement>(null);
  const decisionRef = useRef<HTMLInputElement>(null);

  // Two submit buttons sharing name="decision" with different `value`s relied on the
  // browser including the clicked submitter's name/value pair in the form's FormData —
  // that handoff wasn't happening here, so the server always saw a missing `decision` and
  // rejected it ("Choose approve or decline.") no matter which button was clicked (bug
  // report, 14 Sep 2026). Setting the hidden input's value directly before submitting
  // sidesteps that entirely — the FormData always carries the right decision regardless of
  // how the submit itself is triggered.
  function submitWith(decision: "approve" | "decline") {
    if (decisionRef.current) decisionRef.current.value = decision;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={id} />
      <input ref={decisionRef} type="hidden" name="decision" />
      <input style={{ ...inputStyle, minWidth: 200, flex: "1 1 200px" }} type="text" name="note" placeholder="Note (required to decline)" />
      <button className="btn" type="button" onClick={() => submitWith("approve")} disabled={pending} style={{ fontSize: 12, padding: "8px 12px" }}>
        Approve
      </button>
      <button className="btn ghost" type="button" onClick={() => submitWith("decline")} disabled={pending} style={{ fontSize: 12, padding: "8px 12px", color: "var(--crit)" }}>
        Decline
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

const PAGE_SIZE = 10;

/** One announcement row, with its expandable detail — shared by the Active and
 * Inactive tables below. */
function AnnouncementRow({ a, isOpen, onToggle }: { a: any; isOpen: boolean; onToggle: () => void }) {
  return (
    <Fragment>
      <tr>
        <td><b>{a.title}</b></td>
        <td className="sub">{targetLabel((a.announcement_target ?? [])[0] ?? null, a.scope)}</td>
        <td><StatusChip status={a.status} /></td>
        <td className="n">
          <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={onToggle}>
            {isOpen ? "Close" : "View"}
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={4} style={{ padding: "12px 16px", background: "var(--tint)" }}>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, marginBottom: 8 }}>{a.body}</div>
            {(a.announcement_attachment ?? [])[0]?.file_path && (
              <img
                src={(a.announcement_attachment ?? [])[0].file_path}
                alt=""
                style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, display: "block", marginBottom: 8 }}
              />
            )}
            <div className="sub" style={{ marginBottom: 10 }}>
              {a.published_at ? `Published ${fmtDhaka(a.published_at)}` : "Not yet published"}
              {a.expires_at ? ` · visible until ${fmtDhaka(a.expires_at)}` : ""}
              {a.decision_note ? ` · note: "${a.decision_note}"` : ""}
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
}

/** Prev/Next pager for a client-paginated list — shown only once there's more than one page. */
function Pager({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "flex-end", padding: "10px 16px" }}>
      <button
        className="btn ghost"
        type="button"
        style={{ fontSize: 12, padding: "6px 10px" }}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <span className="sub">Page {page} of {totalPages}</span>
      <button
        className="btn ghost"
        type="button"
        style={{ fontSize: 12, padding: "6px 10px" }}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

/** A paginated (10/page) announcements table with its own row-expand state. */
function AnnouncementsTable({ items }: { items: any[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
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
            {pageItems.map((a) => (
              <AnnouncementRow key={a.id} a={a} isOpen={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} />
            ))}
            {items.length === 0 && (
              <tr><td colSpan={4} className="sub">Nothing here yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={(p) => { setPage(p); setOpen(null); }} />
    </>
  );
}

export default function AdminAnnouncements({
  pending,
  active,
  inactive,
  subjects,
  classLevels,
  teachers,
  teacherSubjects,
}: {
  pending: any[];
  active: any[];
  inactive: any[];
  subjects: Subject[];
  classLevels: ClassLevel[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
}) {
  return (
    <>
      <div className="panel">
        <div className="phead">
          <div className="ptitle">New announcement</div>
          <div className="sub">Goes live immediately</div>
        </div>
        <div style={{ padding: 16 }}>
          <CreateForm subjects={subjects} classLevels={classLevels} teachers={teachers} teacherSubjects={teacherSubjects} />
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
                {(r.announcement_attachment ?? [])[0]?.file_path && (
                  <img
                    src={(r.announcement_attachment ?? [])[0].file_path}
                    alt=""
                    style={{ maxWidth: "100%", maxHeight: 320, borderRadius: 8, display: "block", marginBottom: 8 }}
                  />
                )}
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
          <div className="ptitle">Active</div>
          <div className="sub">{active.length} live</div>
        </div>
        <AnnouncementsTable items={active} />
      </div>

      <details className="panel collapsible">
        <summary className="phead">
          <div className="ptitle">Inactive</div>
          <div className="sub">{inactive.length} declined or taken down</div>
        </summary>
        <AnnouncementsTable items={inactive} />
      </details>
    </>
  );
}
