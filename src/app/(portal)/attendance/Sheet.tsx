"use client";
import { useActionState, useEffect, useState } from "react";
import { saveAttendance } from "./actions";
import type { AttClass } from "./shared";

/** One class's student list with a Present / Absent switch per student and Save.
 * A class not taken yet starts with everyone present; tap Absent for those missing. */
export default function Sheet({ cls, date, readOnly }: { cls: AttClass; date: string; readOnly: boolean }) {
  const [state, action, pending] = useActionState(saveAttendance, null);
  const initial = () => Object.fromEntries(cls.students.map((s) => [s.id, s.status ?? "present"])) as Record<string, "present" | "absent">;
  const [marks, setMarks] = useState(initial);
  const [dirty, setDirty] = useState(false);
  // Fresh data after a save (or another person's change) resets the switches.
  useEffect(() => { setMarks(initial()); setDirty(false); }, [cls]); // eslint-disable-line react-hooks/exhaustive-deps

  const editable = cls.can_edit && !readOnly;
  const absent = cls.students.filter((s) => marks[s.id] === "absent").length;
  const present = cls.students.length - absent;
  const set = (id: string, v: "present" | "absent") => { setMarks((m) => ({ ...m, [id]: v })); setDirty(true); };

  if (!cls.students.length) return <div className="sub" style={{ padding: "12px 18px" }}>No students in this class on this day.</div>;

  return (
    <form action={action}>
      <input type="hidden" name="slot_id" value={cls.slot_id} />
      <input type="hidden" name="date" value={date} />
      {cls.students.map((s) => (
        <div key={s.id} className={`att-row${marks[s.id] === "absent" ? " absent" : ""}`}>
          <input type="hidden" name={`m_${s.id}`} value={marks[s.id]} />
          <div className="who">
            <b>{s.name}</b>
            {s.reg_no && <div className="sub mono" style={{ fontSize: 11.5 }}>{s.reg_no}</div>}
          </div>
          <div className="att-sw" role="group" aria-label={`Attendance for ${s.name}`}>
            <button type="button" className={`p${marks[s.id] === "present" ? " on" : ""}`} aria-pressed={marks[s.id] === "present"}
              disabled={!editable} onClick={() => set(s.id, "present")}>Present</button>
            <button type="button" className={`a${marks[s.id] === "absent" ? " on" : ""}`} aria-pressed={marks[s.id] === "absent"}
              disabled={!editable} onClick={() => set(s.id, "absent")}>Absent</button>
          </div>
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
        <span className="sub"><b style={{ color: "var(--ok)" }}>{present} present</b> · <b style={{ color: absent ? "var(--crit)" : undefined }}>{absent} absent</b> of {cls.students.length}</span>
        <div style={{ flex: 1 }} />
        {editable && (
          <>
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 12px" }}
              onClick={() => { setMarks(Object.fromEntries(cls.students.map((s) => [s.id, "present"]))); setDirty(true); }}>All present</button>
            <button className="btn" type="submit" disabled={pending}>
              {pending ? "Saving…" : cls.session_id ? "Save changes" : "Save attendance"}
            </button>
          </>
        )}
      </div>
      {(state?.error || (state?.ok && !dirty && !pending)) && (
        <div className="sub" style={{ padding: "0 18px 12px", color: state?.error ? "var(--crit)" : "var(--ok)" }}>
          {state?.error ?? "Attendance saved."}
        </div>
      )}
    </form>
  );
}
