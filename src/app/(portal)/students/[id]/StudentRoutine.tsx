"use client";
import { WEEKDAYS, fmtTime } from "../../roster/shared";

export type RoutineRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  title: string;
  teacherName: string;
};

// This student's actual weekly routine — built server-side in page.tsx from the class_slot
// rows attached to their active subject enrolments (and, for Junior students, their class
// level), reusing the same day-grouped/print layout as the main Class Schedule page. Kept
// admin-only for now (gated by the page, not here).
export default function StudentRoutine({ rows }: { rows: RoutineRow[] }) {
  const byDay = WEEKDAYS.map((_, wd) =>
    rows.filter((r) => r.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
  );
  const hasAny = rows.length > 0;

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Routine</div>
        <div className="sub">{rows.length} class{rows.length === 1 ? "" : "es"} / week</div>
        <div className="spacer" />
        <button
          className="btn no-print"
          type="button"
          style={{ fontSize: 12, padding: "6px 10px" }}
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
      {hasAny ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {WEEKDAYS.map((day, wd) => {
            const dayRows = byDay[wd];
            if (dayRows.length === 0) return null;
            return (
              <div key={day} className="tblwrap" style={{ borderTop: "1px solid var(--line)" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>{day}</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.map((r) => (
                      <tr key={r.id}>
                        <td className="mono sub">{fmtTime(r.start_time)} – {fmtTime(r.end_time)}</td>
                        <td><b>{r.title}</b></td>
                        <td className="sub">{r.teacherName}</td>
                        <td className="sub">{r.room ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sub" style={{ padding: 18 }}>No classes scheduled yet for this student&apos;s active subjects.</div>
      )}
    </div>
  );
}
