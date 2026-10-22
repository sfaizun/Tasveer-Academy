import type { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { type GradeScale, fmtNum, gradeTone, scaleText } from "@/lib/grade";
import { MARK_COLS, toMarkRow } from "./marks";
import type { MarkRow } from "./TestMarkForm";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const avgOf = (rows: MarkRow[]) => rows.reduce((s, r) => s + r.percentage, 0) / rows.length;

/** Read-only results for the signed-in student (a guardian sees each of their children).
 * Row level security returns only their own marks. Grouped by subject, newest first. */
export default async function StudentMarks({ supabase }: { supabase: Supabase }) {
  const { data } = await supabase
    .from("test_mark")
    .select(MARK_COLS)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false });
  const rows = ((data ?? []) as any[]).map(toMarkRow);

  if (rows.length === 0) {
    return <div className="panel"><div className="sub" style={{ padding: 18 }}>No test marks have been recorded yet.</div></div>;
  }

  const students = new Map<string, MarkRow[]>();
  for (const r of rows) students.set(r.student_id, [...(students.get(r.student_id) ?? []), r]);
  const many = students.size > 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {[...students.entries()].map(([sid, list]) => {
        const subjects = new Map<string, MarkRow[]>();
        for (const r of list) subjects.set(r.subject_label, [...(subjects.get(r.subject_label) ?? []), r]);
        const ordered = [...subjects.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        return (
          <div key={sid} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {many && <h2 style={{ margin: 0, fontSize: 17, color: "var(--ink)" }}>{list[0].student_name}</h2>}
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
              <div className="panel" style={{ padding: "12px 14px" }}><div className="lbl">Tests</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{list.length}</b></div>
              <div className="panel" style={{ padding: "12px 14px" }}><div className="lbl">Overall average</div><b className="mono" style={{ fontSize: 18, color: "var(--ink)" }}>{avgOf(list).toFixed(1)}%</b></div>
              <div className="panel" style={{ padding: "12px 14px" }}>
                <div className="lbl">Latest</div>
                <b style={{ fontSize: 15, color: "var(--ink)" }}><span className={`grade ${gradeTone(list[0].grade, list[0].grade_scale)}`}>{list[0].grade}</span> <span className="sub">{list[0].subject_label}</span></b>
              </div>
            </div>
            <div className="panel">
              <div className="tblwrap">
                <table>
                  <thead><tr><th>Date</th><th>Test</th><th className="n">Marks</th><th className="n">%</th><th>Grade</th><th>Remarks</th><th>Attachment</th></tr></thead>
                  <tbody>
                    {ordered.map(([label, marks]) => (
                      <SubjectRows key={label} label={label} marks={marks} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
      {[...new Set(rows.map((r) => r.grade_scale))].map((sc) => (
        <div key={sc} className="sub">{scaleText(sc as GradeScale)}</div>
      ))}
    </div>
  );
}

function SubjectRows({ label, marks }: { label: string; marks: MarkRow[] }) {
  const avg = avgOf(marks);
  return (
    <>
      <tr>
        <td colSpan={7} style={{ background: "var(--tint)" }}>
          <b style={{ color: "var(--ink)" }}>{label}</b>{" "}
          <span className="sub">{marks.length} {marks.length === 1 ? "test" : "tests"} · average {avg.toFixed(1)}%</span>
        </td>
      </tr>
      {marks.map((r) => (
        <tr key={r.id}>
          <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.test_date)}</td>
          <td>{r.kind === "mock" && <span className="st part" style={{ marginRight: 6 }}>Mock</span>}{r.test_name}</td>
          <td className="n mono" style={{ whiteSpace: "nowrap" }}>{fmtNum(r.marks)} / {fmtNum(r.out_of)}</td>
          <td className="n mono">{r.percentage.toFixed(2)}</td>
          <td><span className={`grade ${gradeTone(r.grade, r.grade_scale)}`}>{r.grade}</span></td>
          <td style={{ whiteSpace: "pre-wrap" }}>{r.remarks ?? <span className="sub">-</span>}</td>
          <td>{r.attachment_name ? <a href={`/test-marks/file/${r.id}`} target="_blank" rel="noopener" style={{ fontSize: 12.5 }}>View file</a> : <span className="sub">-</span>}</td>
        </tr>
      ))}
    </>
  );
}
