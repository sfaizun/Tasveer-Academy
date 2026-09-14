"use client";
import { Fragment, useActionState, useMemo, useState } from "react";
import { taka, fmtDate, fmtDateTime } from "@/lib/format";
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

function ReviewForm({ appId, currentStatus }: { appId: string; currentStatus: string }) {
  const [state, action, pending] = useActionState(setApplicationStatus, null);

  return (
    <form action={action} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input type="hidden" name="id" value={appId} />
      <select style={selStyle} name="status" defaultValue={currentStatus}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type="text"
        name="note"
        placeholder="Note (optional)"
        style={{ ...selStyle, minWidth: 200, flex: "1 1 200px" }}
      />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "8px 14px" }}>
        {pending ? "Saving…" : "Update status"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && !state.studentId && <span className="sub" style={{ color: "var(--ok)" }}>Updated.</span>}
      {state?.ok && state.studentId && (
        <span className="sub" style={{ color: "var(--ok)" }}>
          Approved — student record, guardian, enrolments and the first invoice were created.{" "}
          <a href="/students">View in Students →</a>
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

function ApplicationDetail({ app }: { app: ApplicationRow }) {
  const p = app.payload ?? {};
  const student = p.student ?? {};
  const guardian = p.guardian ?? {};
  const siblings = p.siblings ?? [];
  const subjects = p.subjects ?? [];
  const fee = p.fee_summary ?? {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "16px 18px", background: "var(--tint)" }}>
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
            {p.mock_only ? "Mock exam subjects" : "Subjects"}
          </div>
          <div className="tblwrap">
            <table>
              {p.mock_only ? (
                <>
                  <thead>
                    <tr><th>Subject</th></tr>
                  </thead>
                  <tbody>
                    {subjects.map((s: any, i: number) => (
                      <tr key={i}>
                        <td>{s.subject_name}{s.level ? ` (${String(s.level).toUpperCase()})` : ""}</td>
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
                        <td className="mono sub">{fmtDate(s.from_month)}</td>
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
              <Detail label="Mock exam fee" value={taka(fee.mock_fee ?? 0)} />
              <Detail label="Total due on approval" value={taka((fee.admission_fee ?? 0) + (fee.mock_fee ?? 0))} />
            </>
          ) : (
            <>
              <Detail label="Monthly fee" value={taka(fee.monthly_total ?? 0)} />
              <Detail label="First month estimate" value={taka(fee.first_month_estimate ?? 0)} />
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
              ? "and the mock exam subject registrations"
              : "and subject enrolments"}
            , and generates the first invoice — it can&apos;t be undone from here.
          </div>
        )}
        <ReviewForm appId={app.id} currentStatus={app.status} />
      </div>
    </div>
  );
}

export default function ApplicationsTable({ applications }: { applications: ApplicationRow[] }) {
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
                    <td><b>{p.student?.full_name ?? "—"}</b></td>
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
                        <ApplicationDetail app={app} />
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
