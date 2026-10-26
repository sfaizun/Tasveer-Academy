"use client";
import { useActionState, useEffect, useState } from "react";
import { fmtDate, monthName } from "@/lib/format";
import { promoteStudent, undoPromotion } from "./actions";

export type ClassOpt = { id: string; name: string; sort: number };
export type PromotionRow = {
  id: string;
  from_label: string;
  to_label: string;
  effective_month: string;
  note: string | null;
  by: string | null;
  created_at: string;
  undone_at: string | null;
};

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function Undo({ studentId, id }: { studentId: string; id: string }) {
  const [state, action, pending] = useActionState(undoPromotion, null);
  const [ask, setAsk] = useState(false);
  if (!ask) return <button type="button" className="linkbtn" onClick={() => setAsk(true)}>Undo</button>;
  return (
    <form action={action} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="promotion_id" value={id} />
      <span className="sub">Undo this promotion?</span>
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "4px 10px" }}>{pending ? "Undoing…" : "Yes, undo"}</button>
      <button className="btn ghost" type="button" onClick={() => setAsk(false)} style={{ fontSize: 12, padding: "4px 10px" }}>No</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

/** Office: promote the student to the next class or level from a chosen month, and the history of
 * promotions. Nothing is deleted: invoices, payments, marks, attendance, report cards and homework
 * stay with the student. */
export default function PromotePanel({
  studentId, programme, programmeName, classLevel, classes, endingSubjects, hasCard, firstMonth, thisMonth, history, canPromote,
}: {
  studentId: string;
  programme: string;
  programmeName: string;
  classLevel: ClassOpt | null;
  classes: ClassOpt[];
  endingSubjects: string[];
  hasCard: boolean;
  firstMonth: string;
  thisMonth: string;
  history: PromotionRow[];
  canPromote: boolean;
}) {
  const [state, action, pending] = useActionState(promoteStudent, null);
  const [target, setTarget] = useState("");
  const defaultMonth = addMonths(thisMonth, 1) > firstMonth ? addMonths(thisMonth, 1) : firstMonth;
  const [month, setMonth] = useState(defaultMonth);
  const [sure, setSure] = useState(false);
  useEffect(() => { if (state?.ok) { setTarget(""); setSure(false); } }, [state]);

  const options: { value: string; label: string }[] =
    programme === "junior"
      ? [
          ...classes.filter((c) => !classLevel || c.sort > classLevel.sort).map((c) => ({ value: `junior:${c.id}`, label: c.name })),
          { value: "o_level", label: "O Level" },
        ]
      : programme === "o_level"
        ? [{ value: "a_level", label: "A Level" }]
        : [];
  const current = programme === "junior" ? classLevel?.name ?? "Junior" : programmeName;
  const chosen = options.find((o) => o.value === target);
  const pending_ = history.find((h) => !h.undone_at && h.effective_month.slice(0, 7) >= thisMonth);
  const latest = history.find((h) => !h.undone_at);
  const prevMonth = addMonths(month, -1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {canPromote && options.length > 0 && !pending_ && (
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input type="hidden" name="student_id" value={studentId} />
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
            <div className="field">
              <span className="lbl">Now</span>
              <div style={{ ...input, background: "var(--tint)" }}>{current}</div>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="pr-target">Promote to</label>
              <select id="pr-target" name="target" required value={target} onChange={(e) => { setTarget(e.target.value); setSure(false); }} style={input}>
                <option value="" disabled>Choose…</option>
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="pr-month">From month</label>
              <input id="pr-month" type="month" name="effective_month" required min={firstMonth} max={addMonths(thisMonth, 6)} value={month}
                onChange={(e) => { setMonth(e.target.value); setSure(false); }} style={input} />
            </div>
            <div className="field">
              <label className="lbl" htmlFor="pr-note">Note (optional)</label>
              <input id="pr-note" name="note" maxLength={500} placeholder="e.g. Passed STD VIII" style={input} />
            </div>
          </div>

          {chosen && month && (
            <div style={{ border: "1px solid var(--line)", background: "var(--tint)", borderRadius: 8, padding: "12px 14px", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ color: "var(--ink)" }}>{current} to {chosen.label}, from {monthName(`${month}-01`)}</b>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                {programme === "junior" && chosen.value.startsWith("junior:") && (
                  <li>The monthly fee changes to {chosen.label}&apos;s fee from {monthName(`${month}-01`)}. {current} is billed up to {monthName(`${prevMonth}-01`)}.</li>
                )}
                {programme === "junior" && chosen.value === "o_level" && (
                  <li>The junior monthly fee stops after {monthName(`${prevMonth}-01`)}. Add the O Level subjects below, starting {monthName(`${month}-01`)}.</li>
                )}
                {programme === "o_level" && (
                  <li>
                    {endingSubjects.length
                      ? <>These O Level subjects end after {monthName(`${prevMonth}-01`)}: {endingSubjects.join(", ")}.</>
                      : <>No O Level subjects are running.</>}{" "}
                    Add the A Level subjects below, starting {monthName(`${month}-01`)}.
                  </li>
                )}
                <li>No admission fee is charged.</li>
                <li>{hasCard ? `A new ID card showing ${chosen.label === "A Level" || chosen.label === "O Level" ? chosen.label : "the new class"} is issued; print it from the ID card page.` : "The student has no ID card yet; create it as usual."}</li>
                <li>Invoices, payments, marks, attendance, report cards and homework stay with the student.</li>
                {programme === "junior" && <li>The class schedule and attendance lists change straight away.</li>}
              </ul>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
                <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> I have checked this
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={pending || !chosen || !sure}>{pending ? "Promoting…" : "Promote"}</button>
            {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
          </div>
        </form>
      )}
      {state?.ok && (
        <div className="sub" style={{ color: "var(--ok)" }}>
          Promoted. {programme !== "junior" ? "Add the new subjects in the Subjects panel below." : ""}
        </div>
      )}
      {canPromote && pending_ && !state?.ok && (
        <div className="sub">A promotion to {pending_.to_label} from {monthName(pending_.effective_month)} is in place. Undo it below to change it.</div>
      )}
      {canPromote && options.length === 0 && !pending_ && <div className="sub">A Level is the highest level. AS to A2 is handled by changing subjects.</div>}

      {history.length > 0 && (
        <div>
          <div className="lbl" style={{ marginBottom: 6 }}>Promotion history</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <div key={h.id} style={{ fontSize: 13, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "baseline", opacity: h.undone_at ? 0.6 : 1 }}>
                <b style={{ color: "var(--ink)", textDecoration: h.undone_at ? "line-through" : undefined }}>{h.from_label} to {h.to_label}</b>
                <span className="sub">from {monthName(h.effective_month)}{h.by ? ` · by ${h.by}` : ""} · {fmtDate(h.created_at)}</span>
                {h.note && <span className="sub">· {h.note}</span>}
                {h.undone_at && <span className="sub">· undone {fmtDate(h.undone_at)}</span>}
                {canPromote && latest?.id === h.id && !h.undone_at && <Undo studentId={studentId} id={h.id} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
