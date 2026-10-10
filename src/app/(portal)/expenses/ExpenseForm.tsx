"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { addExpense, updateExpense } from "./actions";

export type TeacherOpt = { id: string; full_name: string };
export type ExpenseRow = {
  id: string;
  expense_for: "teacher" | "office";
  teacher_id: string | null;
  expense_date: string;
  amount: number;
  details: string;
};

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

function Seg({ value, onChange }: { value: "teacher" | "office"; onChange: (v: "teacher" | "office") => void }) {
  const btn = (v: "teacher" | "office", label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={value === v}
      style={{
        border: 0, padding: "9px 16px", fontFamily: "inherit", fontSize: 13, cursor: "pointer",
        background: value === v ? "var(--ink)" : "var(--paper)", color: value === v ? "var(--paper)" : "var(--body)",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden", alignSelf: "flex-start" }}>
      {btn("teacher", "Teacher")}
      {btn("office", "Office")}
    </div>
  );
}

/** Add an expense, or edit one when `expense` is given. Teacher expenses show on that
 * teacher's own Reports page; office expenses are admin only. */
export default function ExpenseForm({
  teachers, today, expense, onDone,
}: {
  teachers: TeacherOpt[];
  today: string;
  expense?: ExpenseRow;
  onDone?: () => void;
}) {
  const [state, action, pending] = useActionState(expense ? updateExpense : addExpense, null);
  const ref = useRef<HTMLFormElement>(null);
  const [forWhat, setForWhat] = useState<"teacher" | "office">(expense?.expense_for ?? "teacher");
  const id = expense?.id ?? "new";

  useEffect(() => {
    if (!state?.ok) return;
    if (expense) onDone?.();
    else ref.current?.reset();
  }, [state, expense, onDone]);

  return (
    <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <input type="hidden" name="expense_for" value={forWhat} />
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        <div className="field">
          <span className="lbl">Expense for<Req /></span>
          <Seg value={forWhat} onChange={setForWhat} />
        </div>
        {forWhat === "teacher" && (
          <div className="field">
            <label className="lbl" htmlFor={`ex-t-${id}`}>Teacher<Req /></label>
            <select id={`ex-t-${id}`} style={inputStyle} name="teacher_id" required defaultValue={expense?.teacher_id ?? ""}>
              <option value="" disabled>Choose…</option>
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label className="lbl" htmlFor={`ex-d-${id}`}>Date<Req /></label>
          <input id={`ex-d-${id}`} style={inputStyle} type="date" name="expense_date" required defaultValue={expense?.expense_date ?? today} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`ex-a-${id}`}>Amount (৳)<Req /></label>
          <input id={`ex-a-${id}`} style={inputStyle} type="number" name="amount" min="0.01" step="0.01" inputMode="decimal" required defaultValue={expense?.amount ?? ""} placeholder="e.g. 5000" />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`ex-x-${id}`}>Details<Req /></label>
          <textarea
            id={`ex-x-${id}`} name="details" required defaultValue={expense?.details ?? ""} rows={2}
            style={{ ...inputStyle, resize: "vertical" }}
            placeholder={forWhat === "teacher" ? "e.g. October honorarium, class materials, transport" : "e.g. Electricity bill, rent, stationery"}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : expense ? "Save changes" : "+ Add expense"}</button>
        {expense && <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>}
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && !expense && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
        {!state && !expense && (
          <span className="sub">
            {forWhat === "teacher" ? "The teacher will see this expense in their Reports." : "Office expenses are visible to admin only."}
          </span>
        )}
      </div>
    </form>
  );
}
