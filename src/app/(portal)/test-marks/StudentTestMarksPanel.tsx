import type { createClient } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { fmtNum, gradeTone } from "@/lib/grade";
import { MARK_COLS, toMarkRow } from "./marks";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Latest test marks on a student's page, with a link to add or change them. */
export default async function StudentTestMarksPanel({ supabase, studentId }: { supabase: Supabase; studentId: string }) {
  const { data } = await supabase
    .from("test_mark")
    .select(MARK_COLS)
    .eq("student_id", studentId)
    .order("test_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = ((data ?? []) as any[]).map(toMarkRow);
  return (
    <details className="panel collapsible" open={rows.length > 0}>
      <summary className="phead">
        <div className="ptitle">Test marks</div>
        <div className="sub">{rows.length ? `Latest ${rows.length}` : "None recorded yet"}</div>
        <div className="spacer" />
        <a className="btn ghost no-print" href={`/test-marks?student=${studentId}`} style={{ fontSize: 12, padding: "6px 12px" }}>
          {rows.length ? "All marks, add or edit" : "Add marks"}
        </a>
      </summary>
      {rows.length > 0 && (
        <div className="tblwrap">
          <table>
            <thead><tr><th>Date</th><th>Subject</th><th>Test</th><th className="n">Marks</th><th className="n">%</th><th>Grade</th><th>File</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.test_date)}</td>
                  <td>{r.subject_label}</td>
                  <td>{r.test_name}</td>
                  <td className="n mono" style={{ whiteSpace: "nowrap" }}>{fmtNum(r.marks)} / {fmtNum(r.out_of)}</td>
                  <td className="n mono">{r.percentage.toFixed(2)}</td>
                  <td><span className={`grade ${gradeTone(r.grade)}`}>{r.grade}</span></td>
                  <td>{r.attachment_name ? <a href={`/test-marks/file/${r.id}`} target="_blank" rel="noopener" style={{ fontSize: 12.5 }}>View</a> : <span className="sub">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
