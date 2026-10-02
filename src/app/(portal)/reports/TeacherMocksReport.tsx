import type { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";
import { fmtDate, taka } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type Row = {
  registration_id: string;
  mock_exam_id: string;
  series: string;
  exam_date: string;
  subject_name: string;
  level: string | null;
  programme_code: string;
  teacher_id: string | null;
  teacher_name: string | null;
  via_class: boolean;
  student_id: string;
  student_name: string;
  reg_no: string;
  status: string;
  charged: number;
  collected: number;
  due: number;
};

const STATUS: Record<string, string> = { registered: "Registered", sat: "Sat", absent: "Absent", withdrawn: "Withdrawn" };

function subj(r: Row) {
  return `${r.subject_name} (${r.level ? r.level.toUpperCase() : r.programme_code === "o_level" ? "O Level" : ""})`;
}

function sum(rows: Row[]) {
  return rows.reduce(
    (a, r) => ({
      candidates: a.candidates + (r.status === "withdrawn" ? 0 : 1),
      charged: a.charged + Number(r.charged),
      collected: a.collected + Number(r.collected),
      due: a.due + Number(r.due),
    }),
    { candidates: 0, charged: 0, collected: 0, due: 0 }
  );
}

/** Mock exam fees in the teacher's report. A candidate who studies the subject here counts for
 * their own class teacher; anyone else counts for the teacher set on the exam. Kept separate
 * from the tuition figures. Admin sees every teacher; a teacher sees only their own. */
export default async function TeacherMocksReport({
  supabase, monthDate, fileTag, forTeacher, linkStudents,
}: {
  supabase: Supabase;
  monthDate: string | null;
  fileTag: string;
  forTeacher?: boolean;
  linkStudents?: boolean;
}) {
  const { data } = await supabase.rpc("fn_report_teacher_mocks", { p_month: monthDate });
  const rows = ((data ?? []) as Row[]).map((r) => ({ ...r, charged: Number(r.charged), collected: Number(r.collected), due: Number(r.due) }));

  // Group: teacher -> exam -> candidates
  const byTeacher = new Map<string, { name: string; rows: Row[] }>();
  for (const r of rows) {
    const k = r.teacher_id ?? "none";
    const g = byTeacher.get(k) ?? { name: r.teacher_name ?? "No teacher set", rows: [] };
    g.rows.push(r);
    byTeacher.set(k, g);
  }
  const teachers = [...byTeacher.entries()].sort((a, b) =>
    a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].name.localeCompare(b[1].name)
  );
  const total = sum(rows);

  const examGroups = (list: Row[]) => {
    const m = new Map<string, Row[]>();
    for (const r of list) m.set(r.mock_exam_id, [...(m.get(r.mock_exam_id) ?? []), r]);
    return [...m.values()];
  };

  const examTable = (list: Row[]) => (
    <div className="tblwrap">
      <table>
        <thead>
          <tr>
            <th>Exam</th><th>Date</th><th className="n">Candidates</th>
            <th className="n">Charged</th><th className="n">Collected</th><th className="n">Due</th>
          </tr>
        </thead>
        <tbody>
          {examGroups(list).map((g) => {
            const t = sum(g);
            const e = g[0];
            return (
              <tr key={e.mock_exam_id}>
                <td>
                  <details>
                    <summary style={{ cursor: "pointer" }}>
                      <b style={{ color: "var(--ink)", fontWeight: 500 }}>{subj(e)}</b> <span className="sub">{e.series}</span>
                    </summary>
                    <table style={{ marginTop: 6, width: "100%" }}>
                      <tbody>
                        {g.map((r) => (
                          <tr key={r.registration_id}>
                            <td style={{ padding: "4px 8px" }}>
                              {linkStudents ? <a href={`/students/${r.student_id}`}>{r.student_name}</a> : r.student_name}{" "}
                              <span className="sub mono">{r.reg_no}</span>
                              <div className="sub" style={{ fontSize: 11 }}>
                                {STATUS[r.status] ?? r.status} · {r.via_class ? (forTeacher ? "in your class" : "via class teacher") : (forTeacher ? "not in your class" : "via exam teacher")}
                              </div>
                            </td>
                            <td className="n mono" style={{ padding: "4px 8px" }}>{taka(r.charged)}</td>
                            <td className="n mono" style={{ padding: "4px 8px", color: r.due > 0.5 ? "var(--crit)" : "var(--ok)" }}>
                              {r.due > 0.5 ? `${taka(r.due)} due` : "Paid"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                </td>
                <td className="mono sub" style={{ whiteSpace: "nowrap" }}>{fmtDate(e.exam_date)}</td>
                <td className="n mono">{t.candidates}</td>
                <td className="n mono">{taka(t.charged)}</td>
                <td className="n mono" style={{ color: "var(--ok)" }}>{taka(t.collected)}</td>
                <td className="n mono" style={{ color: t.due > 0.5 ? "var(--crit)" : undefined }}>{taka(t.due)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <details className="panel collapsible" open>
      <summary className="phead" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ptitle">{forTeacher ? "Your mock exams" : "Mock exams by teacher"}</div>
        <div className="sub">
          {forTeacher
            ? "Mock exam fees for your subjects. Kept separate from your tuition figures above."
            : "Each fee counts for the candidate's own class teacher, or the exam's teacher if they don't study the subject here. Not included in the tuition figures."}
        </div>
        <div className="spacer" />
        <ExportCsvButton
          filename={`${forTeacher ? "my-mock-exams" : "mock-exams-by-teacher"}-${fileTag}`}
          headers={["Teacher", "Series", "Subject", "Exam date", "Student", "Reg. no.", "Status", "Charged", "Collected", "Due"]}
          rows={rows.map((r) => [r.teacher_name ?? "No teacher set", r.series, subj(r), r.exam_date, r.student_name, r.reg_no, STATUS[r.status] ?? r.status, r.charged, r.collected, r.due])}
        />
      </summary>
      <div style={{ padding: "14px 18px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <div><div className="lbl">Candidates</div><b className="mono">{total.candidates}</b></div>
        <div><div className="lbl">Charged</div><b className="mono">{taka(total.charged)}</b></div>
        <div><div className="lbl">Collected</div><b className="mono" style={{ color: "var(--ok)" }}>{taka(total.collected)}</b></div>
        <div><div className="lbl">Due</div><b className="mono" style={{ color: total.due > 0.5 ? "var(--crit)" : undefined }}>{taka(total.due)}</b></div>
      </div>

      {rows.length === 0 ? (
        <div className="sub" style={{ padding: "8px 18px 16px" }}>
          No mock exam fees{monthDate ? " billed in this month" : " yet"}.
        </div>
      ) : forTeacher ? (
        examTable(rows)
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {teachers.map(([key, g]) => {
            const t = sum(g.rows);
            return (
              <details key={key} className="mock-teacher">
                <summary>
                  <b style={{ color: key === "none" ? "var(--warn)" : "var(--ink)" }}>{g.name}</b>
                  <span className="sub">{t.candidates} candidate{t.candidates === 1 ? "" : "s"}</span>
                  <span className="spacer" />
                  <span className="mono">{taka(t.charged)}</span>
                  <span className="mono" style={{ color: "var(--ok)" }}>{taka(t.collected)} collected</span>
                  <span className="mono" style={{ color: t.due > 0.5 ? "var(--crit)" : "var(--muted)" }}>{taka(t.due)} due</span>
                </summary>
                {key === "none" && (
                  <div className="sub" style={{ padding: "0 18px 8px" }}>
                    These candidates don&apos;t study the subject here and the exam has no teacher. Set one on the exam (Mock exams, Edit exam).
                  </div>
                )}
                {examTable(g.rows)}
              </details>
            );
          })}
        </div>
      )}
    </details>
  );
}
