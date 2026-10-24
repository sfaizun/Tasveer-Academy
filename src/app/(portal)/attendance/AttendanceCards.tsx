import { createClient } from "@/lib/supabase/server";
import { dhakaTodayISO, fmtDate } from "@/lib/format";
import { holidayOn, loadHolidays } from "@/lib/holidays";
import { classTitle, clock, pct, type AttClass } from "./shared";

/** Dashboard panel for staff: today's classes and whether attendance is taken. */
export async function TodayAttendanceCard({ mine }: { mine: boolean }) {
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const [{ data }, hols] = await Promise.all([
    supabase.rpc("fn_attendance_day", { p_date: today, p_mine: mine }),
    loadHolidays(supabase, today, today),
  ]);
  const classes = (data ?? []) as AttClass[];
  const holiday = holidayOn(hols, today);
  const open = classes.filter((c) => !c.session_id);
  return (
    <div className="panel">
      <div className="phead" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="ptitle">Today&apos;s attendance</div>
        {classes.length > 0 && (open.length
          ? <span className="st past"><span className="dot" />{open.length} of {classes.length} not taken</span>
          : <span className="st paid"><span className="dot" />All {classes.length} taken</span>)}
        <div style={{ flex: 1 }} />
        <a href="/attendance" style={{ fontSize: 13 }}>Take attendance →</a>
      </div>
      {classes.length === 0 ? (
        <div className="sub" style={{ padding: "14px 18px" }}>
          {holiday ? <>Holiday today: <b>{holiday.name}</b>. No classes or attendance.</> : mine ? "You have no classes today." : "No classes on the schedule today."}
        </div>
      ) : (
        (mine ? classes : open).slice(0, 8).map((c) => (
          <div key={c.slot_id} style={{ padding: "10px 18px", borderTop: "1px solid var(--line)", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="mono" style={{ minWidth: 80 }}>{clock(c.start_time)}</span>
            <span style={{ flex: "1 1 200px", fontSize: 13.5 }}>{classTitle(c)}{!mine && c.teacher_name ? <span className="sub"> · {c.teacher_name}</span> : null}</span>
            {c.session_id
              ? <span className="st paid"><span className="dot" />Taken</span>
              : <span className="st past"><span className="dot" />Not taken</span>}
          </div>
        ))
      )}
    </div>
  );
}

type Row = { subject_label: string; held: number; present: number; absent: number; last_date: string | null };

/** Subject-wise attendance for one student: classes, present, absent and the percentages. */
export async function StudentAttendanceCard({ studentId, title }: { studentId: string; title?: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_attendance_summary", { p_student_id: studentId });
  const rows = (data ?? []) as Row[];
  const held = rows.reduce((n, r) => n + r.held, 0);
  const present = rows.reduce((n, r) => n + r.present, 0);
  const absent = held - present;
  return (
    <div className="panel">
      <div className="phead" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div className="ptitle">{title ?? "Attendance"}</div>
        {held > 0 && <span className="sub att-pct">Overall {pct(present, held)}% attended · {pct(absent, held)}% absent</span>}
      </div>
      {rows.length === 0 ? (
        <div className="sub" style={{ padding: "14px 18px" }}>No attendance recorded yet.</div>
      ) : (
        <div className="tblwrap">
          <table>
            <thead>
              <tr><th>Subject</th><th className="n">Classes</th><th className="n">Present</th><th className="n">Absent</th><th className="n">Attended</th><th className="n">Absent %</th><th>Last class</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.subject_label}>
                  <td>{r.subject_label}</td>
                  <td className="n">{r.held}</td>
                  <td className="n" style={{ color: "var(--ok)" }}>{r.present}</td>
                  <td className="n" style={{ color: r.absent ? "var(--crit)" : undefined }}>{r.absent}</td>
                  <td className="n">{pct(r.present, r.held)}%</td>
                  <td className="n">{pct(r.absent, r.held)}%</td>
                  <td className="mono">{r.last_date ? fmtDate(r.last_date) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
