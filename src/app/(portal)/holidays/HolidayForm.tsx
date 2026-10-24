"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { HOLIDAY_KINDS, type Holiday } from "@/lib/holidays";
import { removeHoliday, saveHoliday } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** Add a holiday, or edit one when `holiday` is given. */
export function HolidayForm({ holiday, onDone }: { holiday?: Holiday; onDone?: () => void }) {
  const [state, action, pending] = useActionState(saveHoliday, null);
  const ref = useRef<HTMLFormElement>(null);
  const [start, setStart] = useState(holiday?.start_date ?? "");
  const id = holiday?.id.slice(0, 8) ?? "new";
  useEffect(() => {
    if (!state?.ok) return;
    if (holiday) onDone?.();
    else { ref.current?.reset(); setStart(""); }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {holiday && <input type="hidden" name="id" value={holiday.id} />}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div className="field" style={{ gridColumn: "span 2" }}>
          <label className="lbl" htmlFor={`h-n-${id}`}>Holiday name<Req /></label>
          <input id={`h-n-${id}`} name="name" required maxLength={120} defaultValue={holiday?.name} placeholder="e.g. Eid ul-Adha, Victory Day" style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`h-k-${id}`}>Type<Req /></label>
          <select id={`h-k-${id}`} name="kind" required defaultValue={holiday?.kind ?? ""} style={input}>
            <option value="" disabled>Choose…</option>
            {HOLIDAY_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`h-s-${id}`}>First day<Req /></label>
          <input id={`h-s-${id}`} type="date" name="start_date" required value={start} onChange={(e) => setStart(e.target.value)} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`h-e-${id}`}>Last day</label>
          <input id={`h-e-${id}`} type="date" name="end_date" min={start || undefined} defaultValue={holiday && holiday.end_date !== holiday.start_date ? holiday.end_date : ""} style={input} />
          <span className="sub">Leave empty for one day</span>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`h-note-${id}`}>Note (optional)</label>
          <input id={`h-note-${id}`} name="note" maxLength={500} defaultValue={holiday?.note ?? ""} placeholder="Shown to students, guardians and teachers" style={input} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : holiday ? "Save changes" : "+ Add holiday"}</button>
        {holiday && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !holiday && <span className="sub" style={{ color: "var(--ok)" }}>Holiday added.</span>}
      </div>
    </form>
  );
}

/** Edit / Remove controls for one holiday row. */
export function HolidayRowActions({ holiday }: { holiday: Holiday }) {
  const [open, setOpen] = useState<"edit" | "remove" | null>(null);
  if (open === "edit") return <div style={{ padding: "8px 0" }}><HolidayForm holiday={holiday} onDone={() => setOpen(null)} /></div>;
  if (open === "remove") {
    return (
      <form action={removeHoliday} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="id" value={holiday.id} />
        <span className="sub">Remove this holiday? Attendance taken on these days will count again.</span>
        <button className="btn" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>Remove</button>
        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(null)}>Keep</button>
      </form>
    );
  }
  return (
    <span style={{ display: "inline-flex", gap: 8 }}>
      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen("edit")}>Edit</button>
      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen("remove")}>Remove</button>
    </span>
  );
}
