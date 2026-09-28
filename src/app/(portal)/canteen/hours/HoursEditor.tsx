"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { fmtDate } from "@/lib/format";
import { hhmm, WEEKDAYS, WEEK_ORDER, type CanteenClosureRow, type CanteenHoursRow } from "@/lib/canteen";
import { addClosure, removeClosure, saveHours } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function WeeklyHours({ hours }: { hours: CanteenHoursRow[] }) {
  const [state, action, pending] = useActionState(saveHours, null);
  const [open, setOpen] = useState<Record<number, boolean>>(
    Object.fromEntries(hours.map((h) => [h.weekday, h.is_open]))
  );

  return (
    <form action={action}>
      <div className="tblwrap">
        <table>
          <thead>
            <tr><th>Day</th><th>Open?</th><th>Opens</th><th>Closes</th></tr>
          </thead>
          <tbody>
            {WEEK_ORDER.map((d) => {
              const h = hours.find((x) => x.weekday === d);
              const isOpen = open[d] ?? false;
              return (
                <tr key={d}>
                  <td><b style={{ color: "var(--ink)" }}>{WEEKDAYS[d]}</b></td>
                  <td>
                    <label className={isOpen ? "cswitch on" : "cswitch"} style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        name={`open_${d}`}
                        checked={isOpen}
                        onChange={(e) => setOpen((o) => ({ ...o, [d]: e.target.checked }))}
                        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                      />
                      <i />{isOpen ? "Open" : "Closed"}
                    </label>
                  </td>
                  <td>
                    <input
                      style={inputStyle}
                      type="time"
                      name={`opens_${d}`}
                      defaultValue={hhmm(h?.opens_at) || "11:00"}
                      disabled={!isOpen}
                      aria-label={`${WEEKDAYS[d]} opens`}
                    />
                  </td>
                  <td>
                    <input
                      style={inputStyle}
                      type="time"
                      name={`closes_${d}`}
                      defaultValue={hhmm(h?.closes_at) || "19:30"}
                      disabled={!isOpen}
                      aria-label={`${WEEKDAYS[d]} closes`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line2)" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save hours"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
      </div>
    </form>
  );
}

function AddClosureForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(addClosure, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl" htmlFor="cl-from">First closed day<Req /></label>
          <input id="cl-from" style={inputStyle} type="date" name="date_from" min={today} required />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="cl-to">Last closed day</label>
          <input id="cl-to" style={inputStyle} type="date" name="date_to" min={today} />
        </div>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="cl-reason">Reason<Req /></label>
        <input id="cl-reason" style={inputStyle} name="reason" required placeholder="e.g. Holiday, mock exams" />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "+ Add closure"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
      <div className="sub">Leave the last day empty for a single day. Closed days are left out of the prep suggestions.</div>
    </form>
  );
}

export default function HoursEditor({
  hours,
  closures,
  today,
}: {
  hours: CanteenHoursRow[];
  closures: CanteenClosureRow[];
  today: string;
}) {
  const upcoming = closures.filter((c) => c.date_to >= today);
  const past = closures.filter((c) => c.date_to < today);

  return (
    <div className="hours-grid">
      <div className="panel">
        <div className="phead">
          <div className="ptitle">Weekly hours</div>
          <div className="sub">Selling outside these hours shows a warning but is still allowed</div>
        </div>
        <WeeklyHours hours={hours} />
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Closures</div>
          <div className="sub">Holidays and other days the canteen is shut</div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <AddClosureForm today={today} />
          <div className="tblwrap" style={{ border: "1px solid var(--line2)", borderRadius: 8 }}>
            <table>
              <thead><tr><th>Dates</th><th>Reason</th><th></th></tr></thead>
              <tbody>
                {upcoming.map((c) => (
                  <tr key={c.id}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>
                      {fmtDate(c.date_from)}{c.date_to !== c.date_from ? ` to ${fmtDate(c.date_to)}` : ""}
                    </td>
                    <td>{c.reason}</td>
                    <td className="n">
                      <form action={removeClosure}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "5px 9px" }}>Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {upcoming.length === 0 && (
                  <tr><td colSpan={3} className="sub">No upcoming closures.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {past.length > 0 && (
            <div className="sub">
              Past closures: {past.slice(0, 5).map((c) => `${fmtDate(c.date_from)} (${c.reason})`).join(", ")}
              {past.length > 5 ? ` and ${past.length - 5} more` : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
