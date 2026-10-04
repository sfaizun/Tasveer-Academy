import Link from "next/link";
import { taka } from "@/lib/format";
import { REG_STATUS, subjectLabel } from "@/lib/mock";
import { RegisterForm, WithdrawButton } from "../../mock-exams/MockBits";

export type StudentMockRow = {
  id: string;
  status: string;
  fee: number | null;
  withdrawn_reason: string | null;
  exam: {
    id: string; series: string; status: string; subject: { name: string; level: string | null; programme?: { code: string } | null } | null;
  } | null;
  subject: { name: string; level: string | null; programme?: { code: string } | null } | null;
  invoice: { invoice_no: string; status: string } | null;
};

const PAY: Record<string, string> = { paid: "Paid", partly_paid: "Part paid", unpaid: "Unpaid", void: "Void", waived: "Waived" };

/** A student's mock exams: what they're registered for, with fee and attendance, and (admin) a
 * way to register them for another open exam or withdraw them. */
export default function MockExamsPanel({
  studentId, rows, openExams, canEdit, isMockOnly,
}: {
  studentId: string;
  rows: StudentMockRow[];
  openExams: { id: string; label: string }[];
  canEdit: boolean;
  isMockOnly: boolean;
}) {
  const shown = rows.filter((r) => r.status !== "withdrawn");
  const withdrawn = rows.filter((r) => r.status === "withdrawn");
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Mock exams</div>
        <div className="sub">
          {isMockOnly ? "Mock exam candidate: no ongoing class or monthly tuition" : "Sat alongside regular classes"}
        </div>
        {canEdit && (
          <>
            <div className="spacer" />
            <Link className="btn ghost" href="/mock-exams" style={{ fontSize: 12, padding: "6px 10px" }}>All mock exams</Link>
          </>
        )}
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr><th>Exam</th><th>Fee</th><th>Attendance</th>{canEdit && <th></th>}</tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const rs = REG_STATUS[r.status] ?? { text: r.status, cls: "" };
              return (
                <tr key={r.id}>
                  <td>
                    {canEdit && r.exam ? (
                      <Link href={`/mock-exams/${r.exam.id}`}><b>{subjectLabel(r.subject)}</b></Link>
                    ) : (
                      <b style={{ color: "var(--ink)" }}>{subjectLabel(r.subject)}</b>
                    )}
                    <div className="sub">{r.exam?.series ?? "Subject only"}{r.exam?.status === "cancelled" ? " · cancelled" : ""}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="mono">{taka(r.fee ?? 0)}</span>
                    {r.invoice && <div className="sub">{PAY[r.invoice.status] ?? r.invoice.status} · {r.invoice.invoice_no}</div>}
                  </td>
                  <td><span className={`st ${rs.cls}`}><span className="dot" />{rs.text}</span></td>
                  {canEdit && (
                    <td className="n">
                      {r.status !== "sat" && <WithdrawButton registrationId={r.id} examId={r.exam?.id} studentId={studentId} />}
                    </td>
                  )}
                </tr>
              );
            })}
            {shown.length === 0 && <tr><td colSpan={canEdit ? 6 : 5} className="sub">Not registered for any mock exams.</td></tr>}
          </tbody>
        </table>
      </div>
      {withdrawn.length > 0 && (
        <div className="sub" style={{ padding: "8px 16px 0" }}>
          Withdrawn: {withdrawn.map((r) => `${subjectLabel(r.subject)}${r.exam ? `, ${r.exam.series}` : ""} (${r.withdrawn_reason ?? "no reason"})`).join("; ")}
        </div>
      )}
      {canEdit && (
        <div style={{ padding: 16, borderTop: "1px solid var(--line2)", marginTop: 8 }}>
          <RegisterForm studentId={studentId} exams={openExams} />
          <div className="sub" style={{ marginTop: 8 }}>
            Each exam adds its fee to this month&apos;s invoice. The one-time admission fee is only added if this student has never been charged one.
          </div>
        </div>
      )}
    </div>
  );
}
