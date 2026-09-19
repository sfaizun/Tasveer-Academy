"use client";
import { useMemo, useState } from "react";
import { WEEKDAYS, fmtTime } from "./shared";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", minWidth: 180,
};

export type ScheduleRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  title: string;
  teacherId: string | null;
  teacherName: string;
  subjectId: string | null;
  subjectLabel: string | null;
};

export default function ScheduleView({ rows }: { rows: ScheduleRow[] }) {
  const [subjectFilter, setSubjectFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.subjectId && !seen.has(r.subjectId)) seen.set(r.subjectId, r.subjectLabel ?? "Subject");
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const teacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      if (r.teacherId && !seen.has(r.teacherId)) seen.set(r.teacherId, r.teacherName);
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (!subjectFilter || r.subjectId === subjectFilter) && (!teacherFilter || r.teacherId === teacherFilter)
      ),
    [rows, subjectFilter, teacherFilter]
  );

  const byDay = useMemo(
    () =>
      WEEKDAYS.map((_, wd) =>
        filtered.filter((r) => r.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
      ),
    [filtered]
  );

  const hasFilter = !!(subjectFilter || teacherFilter);

  return (
    <>
      <div className="panel no-print">
        <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
          <div className="ptitle">Filter &amp; print</div>
          <div className="sub">
            {filtered.length}
            {hasFilter ? ` of ${rows.length}` : ""} class{filtered.length === 1 ? "" : "es"}
          </div>
          <div className="spacer" />
          <select
            style={selStyle}
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter by subject"
          >
            <option value="">Filter by subject — all</option>
            {subjectOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
          <select
            style={selStyle}
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            aria-label="Filter by teacher"
          >
            <option value="">Filter by teacher — all</option>
            {teacherOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          {hasFilter && (
            <button
              className="btn ghost"
              type="button"
              style={{ fontSize: 12, padding: "6px 10px" }}
              onClick={() => {
                setSubjectFilter("");
                setTeacherFilter("");
              }}
            >
              Clear
            </button>
          )}
          <button
            className="btn"
            type="button"
            style={{ fontSize: 12, padding: "6px 10px" }}
            onClick={() => window.print()}
          >
            Print
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {WEEKDAYS.map((day, wd) => {
          const dayRows = byDay[wd];
          return (
            <div className="panel" key={day}>
              <div className="phead">
                <div className="ptitle">{day}</div>
                <div className="sub">{dayRows.length} class{dayRows.length === 1 ? "" : "es"}</div>
              </div>
              <div className="tblwrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Class</th>
                      <th>Teacher</th>
                      <th>Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayRows.map((r) => (
                      <tr key={r.id}>
                        <td className="mono">{fmtTime(r.start_time)} – {fmtTime(r.end_time)}</td>
                        <td><b>{r.title}</b></td>
                        <td className="sub">{r.teacherName}</td>
                        <td className="sub">{r.room ?? "—"}</td>
                      </tr>
                    ))}
                    {dayRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="sub">No classes scheduled.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
