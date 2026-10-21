"use client";
import { Fragment, useActionState, useMemo, useState } from "react";
import { taka, fmtDate, fmtDateTime } from "@/lib/format";
import type { DupMatch } from "@/lib/duplicates";
import { setApplicationStatus } from "./actions";

export type ApplicationRow = {
  id: string;
  ref_no: string;
  status: string;
  payload: any;
  submitted_at: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "changes_requested", label: "Changes requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 12px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", minWidth: 180,
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    submitted: { cls: "due", label: "Submitted" },
    under_review: { cls: "part", label: "Under review" },
    changes_requested: { cls: "past", label: "Changes requested" },
    approved: { cls: "paid", label: "Approved" },
    rejected: { cls: "over", label: "Rejected" },
    draft: { cls: "due", label: "Draft" },
  };
  const m = map[status] ?? { cls: "due", label: status };
  return (
    <span className={`st ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

function programmeName(code: string) {
  return code === "junior" ? "Junior" : code === "o_level" ? "O Level" : code === "a_level" ? "A Level" : code;
}

function MockBadge() {
  return (
    <span
      className="chip"
      style={{ fontSize: 11, padding: "3px 8px", color: "var(--blue)", borderColor: "var(--blue-soft)", background: "var(--blue-soft)" }}
    >
      Mock exam only
    </span>
  );
}

function DuplicateBadge() {
  return (
    <span className="chip" style={{ fontSize: 11, padding: "3px 8px", color: "var(--warn)", borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
      Possible duplicate
    </span>
  );
}

/** Existing students (and other open applications) that look like the same person. */
function DuplicateWarning({ matches }: { matches: DupMatch[] }) {
  return (
    <div role="alert" style={{ border: "1px solid var(--warn)", background: "var(--warn-soft)", borderRadius: 8, padding: "12px 14px" }}>
      <div style={{ fontWeight: 600, color: "var(--warn)", marginBottom: 6 }}>
        Possible duplicate: {matches.length === 1 ? "this looks like a student already on record" : `${matches.length} records look like this student`}
      </div>
      <div className="tblwrap" style={{ background: "var(--paper)", borderRadius: 6 }}>
        <table>
          <thead>
            <tr><th>Record</th><th>Name</th><th>Phone</th><th>Email</th><th>Status</th><th>Matches on</th></tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.kind + m.id}>
                <td className="mono" style={{ whiteSpace: "nowrap" }}>
                  {m.kind === "student"
                    ? <a href={`/students/${m.id}`} target="_blank" rel="noopener">{m.ref ?? "Student"}</a>
                    : <span>{m.ref} <span className="sub">(application)</span></span>}
                </td>
                <td>{m.full_name ?? "—"}</td>
                <td className="mono sub">{m.phone ?? "—"}</td>
                <td className="sub">{m.email ?? "—"}</td>
                <td className="sub">{String(m.status ?? "").replace(/_/g, " ")}</td>
                <td><b style={{ color: "var(--warn)" }}>{m.reasons.join(", ")}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sub" style={{ marginTop: 8 }}>
        Open the existing record and compare before approving. If it is the same student, reject this application
        instead (add subjects to the existing student). Brothers and sisters can share a phone number.
      </div>
    </div>
  );
}

function ReviewForm({ appId, currentStatus, matches, canApprove }: { appId: string; currentStatus: string; matches: DupMatch[]; canApprove: boolean }) {
  const [state, action, pending] = useActionState(setApplicationStatus, null);
  const [status, setStatus] = useState(currentStatus);
  const [confirmed, setConfirmed] = useState(false);
  const needsConfirm = status === "approved" && currentStatus !== "approved" && matches.length > 0;
  // Approving creates the student and their ID card in one step.
  const approving = status === "approved" && currentStatus !== "approved";

  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="id" value={appId} />
      <select style={selStyle} name="status" value={status} onChange={(e) => { setStatus(e.target.value); setConfirmed(false); }}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} disabled={o.value === "approved" && !canApprove && currentStatus !== "approved"}>
            {o.value === "approved" && !canApprove && currentStatus !== "approved" ? "Approved (Super Admin or Office Admin)" : o.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="note"
        placeholder="Note (optional)"
        style={{ ...selStyle, minWidth: 200, flex: "1 1 200px" }}
      />
      {needsConfirm && (
        <label style={{ flexBasis: "100%", display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--warn)", fontWeight: 600 }}>
          <input type="checkbox" name="confirm_duplicate" value="1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          I have checked the {matches.length === 1 ? "matching record" : `${matches.length} matching records`}: this is a different student, approve anyway
        </label>
      )}
      {approving && (
        <div style={{ flexBasis: "100%", display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "var(--tint)", border: "1px solid var(--line)", borderRadius: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Student ID card</div>
          <div className="sub">Approving creates the student&apos;s ID card (student and guardian details, student ID, barcode and QR codes). An application can&apos;t be approved without it.</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" name="create_card" value="1" required defaultChecked /> Create the student ID card
          </label>
        </div>
      )}
      <button className="btn" type="submit" disabled={pending || (needsConfirm && !confirmed)} style={{ fontSize: 12, padding: "8px 14px" }}>
        {pending ? "Saving…" : approving ? "Create ID card and approve" : "Update status"}
      </button>

      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && !state.studentId && <span className="sub" style={{ color: "var(--ok)" }}>Updated.</span>}
      {state?.ok && state.studentId && (
        <span className="sub" style={{ color: "var(--ok)" }}>
          Approved. Student record, guardian, enrolments and the student ID card were created, with
          invoices from the start month (admission fee on the first).{" "}
          <a href={`/students/${state.studentId}/id-card`}>Print the ID card</a>{" · "}
          <a href={`/students/${state.studentId}`}>Open the student</a>
        </span>
      )}
    </form>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="lbl" style={{ marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink)" }}>{value || <span className="sub">—</span>}</div>
    </div>
  );
}

function ApplicationDetail({ app, matches, canApprove }: { app: ApplicationRow; matches: DupMatch[]; canApprove: boolean }) {
  const p = app.payload ?? {};
  const student = p.student ?? {};
  const guardian = p.guardian ?? {};
  const siblings = p.siblings ?? [];
  const subjects = p.subjects ?? [];
  const fee = p.fee_summary ?? {};
  // Approval bills every month from the start month to the current month; the admission fee
  // is only on the first of those invoices.
  const monthsDue = (() => {
    if (!/^\d{4}-\d{2}$/.test(p.start_month ?? "")) return 1;
    const [sy, sm] = String(p.start_month).split("-").map(Number);
    const now = new Date();
    return Math.max(1, (now.getFullYear() - sy) * 12 + (now.getMonth() + 1 - sm) + 1);
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "16px 18px", background: "var(--tint)" }}>
      {matches.length > 0 && <DuplicateWarning matches={matches} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        <Detail label="Visit date" value={p.visit_date ? fmtDate(p.visit_date) : p.visit_date} />
        <Detail
          label="Programme"
          value={
            <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {programmeName(p.programme_code)}
              {p.mock_only && <MockBadge />}
            </span>
          }
        />
        {!p.mock_only && (
          <Detail
            label={p.programme_code === "junior" ? "Class" : "Start month"}
            value={p.programme_code === "junior" ? p.class_level_code : p.start_month}
          />
        )}
        <Detail label="Previous reg. no." value={p.previous_reg_no} />
      </div>

      <div>
        <div className="ptitle" style={{ marginBottom: 8 }}>Student</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Detail label="Full name" value={student.full_name} />
          <Detail label="Gender" value={student.gender} />
          <Detail label="Nationality" value={student.nationality} />
          <Detail label="WhatsApp / mobile" value={student.phone} />
          <Detail label="Email" value={student.email} />
          <Detail label="School" value={student.school_name} />
        </div>
        {student.address && <div style={{ marginTop: 10 }}><Detail label="Address" value={student.address} /></div>}
      </div>

      <div>
        <div className="ptitle" style={{ marginBottom: 8 }}>Guardian</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
          <Detail label="Full name" value={guardian.full_name} />
          <Detail label="Relation" value={guardian.relation} />
          <Detail label="Father's name" value={guardian.father_name} />
          <Detail label="Mother's name" value={guardian.mother_name} />
          <Detail label="WhatsApp / mobile" value={guardian.phone} />
          <Detail label="Email" value={guardian.email} />
        </div>
        {guardian.address && <div style={{ marginTop: 10 }}><Detail label="Address" value={guardian.address} /></div>}
      </div>

      {siblings.length > 0 && (
        <div>
          <div className="ptitle" style={{ marginBottom: 8 }}>Siblings</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5 }}>
            {siblings.map((s: any, i: number) => (
              <li key={i}>
                {s.full_name}
                {s.class_name ? ` — ${s.class_name}` : ""}
                {s.school_name ? `, ${s.school_name}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {subjects.length > 0 && (
        <div>
          <div className="ptitle" style={{ marginBottom: 8 }}>
            {p.mock_only ? "Mock exams" : "Subjects"}
          </div>
          <div className="tblwrap">
            <table>
              {p.mock_only ? (
                <>
                  <thead>
                    <tr><th>Mock exam</th><th className="n">Fee</th></tr>
                  </thead>
                  <tbody>
                    {subjects.map((s: any, i: number) => (
                      <tr key={i}>
                        <td>{s.mock_exam_label ?? `${s.subject_name}${s.level ? ` (${String(s.level).toUpperCase()})` : ""}`}</td>
                        <td className="n mono">{s.mock_fee != null ? taka(s.mock_fee) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead>
                    <tr><th>Subject</th><th>Teacher</th><th>From</th><th className="n">Fee/month</th></tr>
                  </thead>
                  <tbody>
                    {subjects.map((s: any, i: number) => (
                      <tr key={i}>
                        <td>{s.subject_name}{s.level ? ` (${String(s.level).toUpperCase()})` : ""}</td>
                        <td>{s.teacher_name}</td>
                        <td className="mono sub">{p.start_month ? fmtDate(`${p.start_month}-01`) : "—"}</td>
                        <td className="n mono">{taka(s.monthly_fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </>
              )}
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="ptitle" style={{ marginBottom: 8 }}>Fee summary (indicative)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14 }}>
          <Detail label="Admission fee" value={taka(fee.admission_fee ?? 0)} />
          {p.mock_only ? (
            <>
              <Detail label={`Mock exam fees (${subjects.length})`} value={taka(fee.mock_fee ?? 0)} />
              <Detail label="Total due on approval" value={taka((fee.admission_fee ?? 0) + (fee.mock_fee ?? 0))} />
            </>
          ) : (
            <>
              <Detail
                label={monthsDue > 1 ? `Monthly fees (${monthsDue} months from ${p.start_month})` : "Monthly fee (full month)"}
                value={
                  monthsDue > 1
                    ? `${taka(fee.monthly_total ?? 0)} × ${monthsDue} = ${taka((fee.monthly_total ?? 0) * monthsDue)}`
                    : taka(fee.monthly_total ?? 0)
                }
              />
              <Detail
                label="Total due on approval"
                value={taka((fee.admission_fee ?? 0) + (fee.monthly_total ?? 0) * monthsDue)}
              />
            </>
          )}
        </div>
      </div>

      {app.review_note && (
        <div>
          <div className="ptitle" style={{ marginBottom: 8 }}>Review note</div>
          <div style={{ fontSize: 13.5 }}>{app.review_note}</div>
          <div className="sub" style={{ marginTop: 2 }}>Last reviewed {fmtDateTime(app.reviewed_at)}</div>
        </div>
      )}

      <div>
        <div className="ptitle" style={{ marginBottom: 8 }}>Update status</div>
        {app.status !== "approved" && (
          <div className="sub" style={{ marginBottom: 8 }}>
            Setting this to Approved creates the student, guardian and sibling records{" "}
            {app.payload?.mock_only
              ? "and registers them for the chosen mock exams"
              : "and subject enrolments"}
            , and generates the first invoice — it can&apos;t be undone from here.
          </div>
        )}
        <ReviewForm appId={app.id} currentStatus={app.status} matches={matches} canApprove={canApprove} />
      </div>
    </div>
  );
}

export default function ApplicationsTable({
  applications, duplicates = {}, canApprove = false,
}: {
  applications: ApplicationRow[];
  duplicates?: Record<string, DupMatch[]>;
  /** Approving creates the ID card: Super Admin and Office Admin. */
  canApprove?: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(
    () => (statusFilter ? applications.filter((a) => a.status === statusFilter) : applications),
    [applications, statusFilter]
  );

  return (
    <div className="panel">
      <div className="phead" style={{ flexWrap: "wrap" }}>
        <div className="ptitle">Applications</div>
        <div className="sub">
          {filtered.length}
          {statusFilter ? ` of ${applications.length}` : ""} total
        </div>
        <div className="spacer" />
        <select style={selStyle} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Filter by status — all</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr>
              <th>Ref no.</th>
              <th>Submitted</th>
              <th>Student</th>
              <th>Programme</th>
              <th>Guardian contact</th>
              <th className="n">Status</th>
              <th className="n"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => {
              const p = app.payload ?? {};
              const isOpen = expanded === app.id;
              return (
                <Fragment key={app.id}>
                  <tr>
                    <td className="mono"><b>{app.ref_no}</b></td>
                    <td className="sub">{fmtDateTime(app.submitted_at ?? app.created_at)}</td>
                    <td>
                      <b>{p.student?.full_name ?? "—"}</b>
                      {duplicates[app.id] && <div style={{ marginTop: 4 }}><DuplicateBadge /></div>}
                    </td>
                    <td>
                      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {programmeName(p.programme_code)}
                        {p.mock_only && <MockBadge />}
                      </span>
                    </td>
                    <td className="sub">{p.guardian?.phone ?? "—"}</td>
                    <td className="n"><StatusChip status={app.status} /></td>
                    <td className="n">
                      <button
                        className="btn ghost"
                        type="button"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        onClick={() => setExpanded(isOpen ? null : app.id)}
                      >
                        {isOpen ? "Hide" : "View"}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <ApplicationDetail app={app} matches={duplicates[app.id] ?? []} canApprove={canApprove} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="sub">No applications match this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
