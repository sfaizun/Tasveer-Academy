import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import PrintButton from "@/components/PrintButton";
import { taka, fmtDate } from "@/lib/format";
import { groupSubjects, type SubjectForGrouping } from "@/lib/subjectGroups";

export const dynamic = "force-dynamic";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", minWidth: 190,
};

const statusMap: Record<string, { cls: string; label: string }> = {
  draft: { cls: "due", label: "Draft" },
  unpaid: { cls: "due", label: "Unpaid" },
  partly_paid: { cls: "part", label: "Partly paid" },
  paid: { cls: "paid", label: "Paid" },
  waived: { cls: "past", label: "Waived" },
  void: { cls: "over", label: "Void" },
};

const lineTypeLabel: Record<string, string> = {
  admission: "Admission fee",
  tuition: "Tuition",
  discount: "Discount",
  adjustment: "Adjustment",
};

type StudentOpt = { id: string; reg_no: string; full_name: string };
type TeacherOpt = { id: string; full_name: string };

/**
 * Admin-only cross-academy invoice finder and printer. An invoice always belongs to one
 * student, but can carry lines for several subjects/teachers — so the student/teacher/
 * subject/month filters here narrow down *which invoices to find*, and every matching
 * invoice then prints as its own real, complete document (every line it actually carries,
 * same as the per-student Invoices history), not a partial slice of just the filtered line.
 */
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; teacher?: string; subject?: string; month?: string }>;
}) {
  const { me } = await getViewer();
  if (me?.role !== "admin") redirect("/dashboard");

  const sp = await searchParams;
  const studentId = typeof sp.student === "string" && sp.student ? sp.student : null;
  const teacherId = typeof sp.teacher === "string" && sp.teacher ? sp.teacher : null;
  const subjectId = typeof sp.subject === "string" && sp.subject ? sp.subject : null;
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : null;
  const monthDate = month ? `${month}-01` : null;
  const hasFilter = !!(studentId || teacherId || subjectId || month);

  const supabase = await createClient();

  const [{ data: students }, { data: teachers }, { data: subjects }] = await Promise.all([
    supabase.from("student").select("id, reg_no, full_name").order("full_name") as unknown as Promise<{ data: StudentOpt[] | null }>,
    supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name") as unknown as Promise<{ data: TeacherOpt[] | null }>,
    supabase
      .from("subject")
      .select("id, name, level, programme(code, name)")
      .eq("active", true)
      .order("sort_order") as unknown as Promise<{ data: SubjectForGrouping[] | null }>,
  ]);
  const subjectGroups = groupSubjects(subjects ?? []);

  // Resolve which invoices actually carry a line for the chosen subject and/or teacher —
  // done as a separate pass over invoice_line (which carries subject_id/enrolment_id
  // directly on tuition and per-subject discount lines) before the main invoice query,
  // since PostgREST can't filter a top-level `invoice` select by a child table's columns.
  let lineFilteredIds: string[] | null = null;
  if (subjectId || teacherId) {
    let lineQuery = supabase
      .from("invoice_line")
      .select(teacherId ? "invoice_id, enrolment!inner(teacher_id)" : "invoice_id");
    if (subjectId) lineQuery = lineQuery.eq("subject_id", subjectId);
    if (teacherId) lineQuery = lineQuery.eq("enrolment.teacher_id", teacherId);
    const { data: lines } = await lineQuery;
    lineFilteredIds = [...new Set((lines ?? []).map((l: any) => l.invoice_id as string))];
  }

  let invoices: any[] = [];
  if (!(lineFilteredIds && lineFilteredIds.length === 0)) {
    let q = supabase
      .from("invoice")
      .select(
        "id, invoice_no, billing_month, due_on, gross, discount, net, paid, balance, status, " +
          "student(id, reg_no, full_name), invoice_line(id, type, description, rate, quantity, amount)"
      )
      .order("billing_month", { ascending: false })
      .order("due_on", { ascending: true })
      .limit(300);
    if (studentId) q = q.eq("student_id", studentId);
    if (monthDate) q = q.eq("billing_month", monthDate);
    if (lineFilteredIds) q = q.in("id", lineFilteredIds);
    const { data } = await q;
    invoices = data ?? [];
  }

  const totals = invoices.reduce(
    (acc, inv) => ({
      net: acc.net + Number(inv.net || 0),
      paid: acc.paid + Number(inv.paid || 0),
      balance: acc.balance + Number(inv.balance || 0),
    }),
    { net: 0, paid: 0, balance: 0 }
  );

  return (
    <>
      <header className="top">
        <h1>Invoices</h1>
        <div className="sub">Find and print invoices by student, teacher, subject, or month</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel no-print">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ptitle">Filter</div>
            <div className="sub">
              {invoices.length} invoice{invoices.length === 1 ? "" : "s"}
              {hasFilter ? " matching" : " total"}
            </div>
          </div>
          <form method="GET" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
            <div className="field">
              <label className="lbl">Student</label>
              <select style={inputStyle} name="student" defaultValue={studentId ?? ""}>
                <option value="">All students</option>
                {(students ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.reg_no})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Teacher</label>
              <select style={inputStyle} name="teacher" defaultValue={teacherId ?? ""}>
                <option value="">All teachers</option>
                {(teachers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Subject</label>
              <select style={inputStyle} name="subject" defaultValue={subjectId ?? ""}>
                <option value="">All subjects</option>
                {subjectGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="sub" style={{ marginTop: 4 }}>Junior classes bill flat per class level, not per subject — use Student instead.</div>
            </div>
            <div className="field">
              <label className="lbl">Month</label>
              <input type="month" name="month" defaultValue={month ?? ""} style={inputStyle} />
            </div>
            <button className="btn" type="submit" style={{ fontSize: 12, padding: "8px 14px" }}>
              Filter
            </button>
            {hasFilter && (
              <a className="btn ghost" href="/invoices" style={{ fontSize: 12, padding: "8px 14px" }}>
                Clear
              </a>
            )}
            <div className="spacer" />
            <PrintButton label={`Print ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} />
          </form>
        </div>

        {invoices.length > 0 && (
          <div className="panel no-print" style={{ padding: "14px 18px", display: "flex", gap: 28, flexWrap: "wrap" }}>
            <div><div className="lbl">Net total</div><div className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{taka(totals.net)}</div></div>
            <div><div className="lbl">Paid</div><div className="mono" style={{ fontSize: 17, fontWeight: 600, color: "var(--ok)" }}>{taka(totals.paid)}</div></div>
            <div><div className="lbl">Balance</div><div className="mono" style={{ fontSize: 17, fontWeight: 600, color: totals.balance > 0 ? "var(--crit)" : "var(--ok)" }}>{taka(totals.balance)}</div></div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {invoices.map((inv) => {
            const m = statusMap[inv.status] ?? { cls: "due", label: inv.status };
            const lines: any[] = inv.invoice_line ?? [];
            return (
              <div className="panel" key={inv.id}>
                <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div className="ptitle mono">{inv.invoice_no}</div>
                    <div className="sub">
                      {inv.student?.full_name} <span className="mono">({inv.student?.reg_no})</span>
                    </div>
                  </div>
                  <div className="spacer" />
                  <div className="sub" style={{ textAlign: "right" }}>
                    <div>Billing month: <b>{fmtDate(inv.billing_month)}</b></div>
                    <div>Due: <b>{fmtDate(inv.due_on)}</b></div>
                  </div>
                  <span className={`st ${m.cls}`}><span className="dot" />{m.label}</span>
                </div>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Line</th>
                        <th>Description</th>
                        <th className="n">Rate</th>
                        <th className="n">Qty</th>
                        <th className="n">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id}>
                          <td className="sub">{lineTypeLabel[l.type] ?? l.type}</td>
                          <td>{l.description}</td>
                          <td className="n mono">{taka(l.rate)}</td>
                          <td className="n mono">{l.quantity}</td>
                          <td className="n mono">
                            {Number(l.amount) < 0 ? "− " + taka(Math.abs(l.amount)) : taka(l.amount)}
                          </td>
                        </tr>
                      ))}
                      {lines.length === 0 && (
                        <tr><td colSpan={5} className="sub">No line items on this invoice.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line2)", display: "flex", justifyContent: "flex-end", gap: 24, flexWrap: "wrap" }}>
                  <div className="sub">Gross <b className="mono" style={{ color: "var(--ink)" }}>{taka(inv.gross)}</b></div>
                  <div className="sub">Discount <b className="mono" style={{ color: "var(--ink)" }}>{Number(inv.discount) > 0 ? "− " + taka(inv.discount) : taka(0)}</b></div>
                  <div className="sub">Net <b className="mono" style={{ color: "var(--ink)" }}>{taka(inv.net)}</b></div>
                  <div className="sub">Paid <b className="mono" style={{ color: "var(--ok)" }}>{taka(inv.paid)}</b></div>
                  <div className="sub">Balance <b className="mono" style={{ color: Number(inv.balance) > 0 ? "var(--crit)" : "var(--ok)" }}>{taka(inv.balance)}</b></div>
                </div>
              </div>
            );
          })}
          {invoices.length === 0 && (
            <div className="panel" style={{ padding: 18 }}>
              <div className="sub">
                {hasFilter ? "No invoices match this filter." : "No invoices yet. Run billing, or approve an admission application."}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
