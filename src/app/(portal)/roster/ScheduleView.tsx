"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { WEEKDAYS, fmtTime } from "./shared";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", minWidth: 180,
};

type Option = { id: string; label: string };

// A dropdown that opens a checklist instead of a native <select> — lets the admin tick
// several subjects at once (e.g. before printing a schedule for just those subjects)
// rather than being limited to one at a time.
function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const summary =
    selected.length === 0
      ? `${label} — all`
      : selected.length === 1
        ? options.find((o) => o.id === selected[0])?.label ?? label
        : `${label}: ${selected.length} selected`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        style={{ ...selStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer" }}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{summary}</span>
        <span style={{ fontSize: 10, opacity: 0.6, flex: "0 0 auto" }}>▾</span>
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 30,
            minWidth: 220, maxHeight: 280, overflowY: "auto",
            background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,.16)", padding: 6,
          }}
        >
          {options.length === 0 && (
            <div className="sub" style={{ padding: "6px 8px" }}>Nothing to filter by yet.</div>
          )}
          {options.map((o) => (
            <label
              key={o.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12.5 }}
            >
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              {o.label}
            </label>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              className="btn ghost"
              style={{ marginTop: 4, width: "100%", fontSize: 11.5, padding: "5px 8px" }}
              onClick={() => onChange([])}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

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
  const [subjectFilters, setSubjectFilters] = useState<string[]>([]);
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
        (r) =>
          (subjectFilters.length === 0 || (!!r.subjectId && subjectFilters.includes(r.subjectId))) &&
          (!teacherFilter || r.teacherId === teacherFilter)
      ),
    [rows, subjectFilters, teacherFilter]
  );

  const byDay = useMemo(
    () =>
      WEEKDAYS.map((_, wd) =>
        filtered.filter((r) => r.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time))
      ),
    [filtered]
  );

  const hasFilter = subjectFilters.length > 0 || !!teacherFilter;

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
          <CheckboxDropdown
            label="Filter by subject"
            options={subjectOptions}
            selected={subjectFilters}
            onChange={setSubjectFilters}
          />
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
                setSubjectFilters([]);
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
              <div className="phead" style={{ background: `var(--day${wd})` }}>
                <div className="ptitle">{day}</div>
                <div className="spacer" />
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
