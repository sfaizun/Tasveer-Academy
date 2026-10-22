"use client";
import { useActionState, useEffect, useState } from "react";
import Req from "@/components/Req";
import { cancelAppointment, rescheduleAppointment, respondAppointment } from "./actions";
import { LENGTHS, StatusTag, apptDay, apptInputs, apptMinutes, apptTime, isDone, withLabel, type ApptRow } from "./shared";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

type Open = { id: string; kind: "decline" | "cancel" | "move" } | null;

function Respond({ row }: { row: ApptRow }) {
  const [state, action, pending] = useActionState(respondAppointment, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="accept" value="1" />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "7px 12px" }}>{pending ? "Saving…" : "Accept"}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

function Decline({ row, onDone }: { row: ApptRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(respondAppointment, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
      <input type="hidden" name="id" value={row.id} />
      <input type="hidden" name="accept" value="0" />
      <label className="lbl" htmlFor={`ap-dn-${row.id}`}>Reason for declining<Req /></label>
      <textarea id={`ap-dn-${row.id}`} name="note" required rows={2} maxLength={1000} style={{ ...input, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Decline request"}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Back</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

function Cancel({ row, onDone }: { row: ApptRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(cancelAppointment, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
      <input type="hidden" name="id" value={row.id} />
      <label className="lbl" htmlFor={`ap-cn-${row.id}`}>Reason for cancelling<Req /></label>
      <textarea id={`ap-cn-${row.id}`} name="reason" required rows={2} maxLength={1000} style={{ ...input, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Cancel appointment"}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Back</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

function Move({ row, today, studentSide, onDone }: { row: ApptRow; today: string; studentSide: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState(rescheduleAppointment, null);
  useEffect(() => { if (state?.ok) onDone(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = apptInputs(row.starts_at);
  const len = apptMinutes(row);
  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 620 }}>
      <input type="hidden" name="id" value={row.id} />
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <div className="field">
          <label className="lbl" htmlFor={`ap-md-${row.id}`}>New date<Req /></label>
          <input id={`ap-md-${row.id}`} type="date" name="date" required min={today} defaultValue={cur.date} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`ap-mt-${row.id}`}>New time<Req /></label>
          <input id={`ap-mt-${row.id}`} type="time" name="time" required step={300} defaultValue={cur.time} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`ap-ml-${row.id}`}>Length<Req /></label>
          <select id={`ap-ml-${row.id}`} name="minutes" defaultValue={String(LENGTHS.includes(len) ? len : 30)} style={input}>
            {LENGTHS.map((m) => <option key={m} value={m}>{m} minutes</option>)}
          </select>
        </div>
      </div>
      <label className="lbl" htmlFor={`ap-mr-${row.id}`}>Reason for moving<Req /></label>
      <textarea id={`ap-mr-${row.id}`} name="reason" required rows={2} maxLength={1000} style={{ ...input, resize: "vertical" }} />
      {studentSide && <div className="sub">The new time goes back to your teacher or the office to accept.</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Move appointment"}</button>
        <button className="btn ghost" type="button" onClick={onDone}>Back</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

/** A list of appointments with Accept / Decline / Move / Cancel where the viewer may act.
 * `showStudent` adds the student's name (staff views). */
export default function ApptList({ rows, today, showStudent, studentSide, readOnly, empty }: {
  rows: ApptRow[]; today: string; showStudent: boolean; studentSide: boolean; readOnly: boolean; empty: string;
}) {
  const [open, setOpen] = useState<Open>(null);
  if (!rows.length) return <div className="sub" style={{ padding: "14px 18px" }}>{empty}</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r) => {
        const active = (r.status === "pending" || r.status === "confirmed") && !isDone(r);
        const answer = !readOnly && active && r.status === "pending" && r.can_handle;
        const change = !readOnly && active && r.can_change;
        const isOpen = open?.id === r.id ? open.kind : null;
        return (
          <div key={r.id} style={{ padding: "14px 18px", borderTop: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600 }}>{apptDay(r.starts_at)}</span>
              <span className="mono">{apptTime(r.starts_at)} to {apptTime(r.ends_at)}</span>
              <StatusTag row={r} />
            </div>
            <div style={{ fontSize: 13.5 }}>
              {showStudent && <><b>{r.student_name}</b>{r.reg_no ? <span className="sub"> ({r.reg_no})</span> : null} with </>}
              {!showStudent && "With "}
              {withLabel(r)}
            </div>
            {r.note && <div className="sub">“{r.note}”</div>}
            <div className="sub">
              {r.booked_as === "student" ? "Requested by the student" : `Booked by ${r.booked_by_name ?? (r.booked_as === "teacher" ? "the teacher" : "the office")}`}
              {r.previous_starts_at && <> · Moved from {apptDay(r.previous_starts_at)}, {apptTime(r.previous_starts_at)}{r.rescheduled_by_name ? ` by ${r.rescheduled_by_name}` : ""}{r.reschedule_reason ? `: ${r.reschedule_reason}` : ""}</>}
            </div>
            {r.response_note && <div className="sub">{r.status === "declined" ? "Declined" : "Reply"}: {r.response_note}</div>}
            {r.status === "cancelled" && r.cancel_reason && <div className="sub">Cancelled: {r.cancel_reason}</div>}

            {(answer || change) && !isOpen && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                {answer && <Respond row={r} />}
                {answer && <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => setOpen({ id: r.id, kind: "decline" })}>Decline</button>}
                {change && <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => setOpen({ id: r.id, kind: "move" })}>Move</button>}
                {change && <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => setOpen({ id: r.id, kind: "cancel" })}>Cancel</button>}
              </div>
            )}
            {isOpen === "decline" && <Decline row={r} onDone={() => setOpen(null)} />}
            {isOpen === "cancel" && <Cancel row={r} onDone={() => setOpen(null)} />}
            {isOpen === "move" && <Move row={r} today={today} studentSide={studentSide} onDone={() => setOpen(null)} />}
          </div>
        );
      })}
    </div>
  );
}
