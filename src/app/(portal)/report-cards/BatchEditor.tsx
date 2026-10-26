"use client";
import { useActionState, useEffect, useState } from "react";
import { saveRcComments } from "./actions";
import { CATEGORIES, attendance, homework, type RcBatchRow, type RcComment } from "./shared";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

function CommentSelect({ name, value, comments, onChange, disabled, placeholder, exclude }: {
  name: string; value: string; comments: RcComment[]; onChange: (v: string) => void; disabled: boolean;
  placeholder: string; exclude?: string;
}) {
  return (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value)} style={input} disabled={disabled}>
      <option value="">{placeholder}</option>
      {CATEGORIES.map((c) => {
        const list = comments.filter((x) => x.category === c.key && x.id !== exclude && (x.active || x.id === value));
        return list.length ? (
          <optgroup key={c.key} label={c.label}>
            {list.map((x) => <option key={x.id} value={x.id}>{x.text}</option>)}
          </optgroup>
        ) : null;
      })}
    </select>
  );
}

function Row({ row, comments, canEdit, month }: { row: RcBatchRow; comments: RcComment[]; canEdit: boolean; month: string }) {
  const [state, action, pending] = useActionState(saveRcComments, null);
  const [c1, setC1] = useState(row.comment_ids[0] ?? "");
  const [c2, setC2] = useState(row.comment_ids[1] ?? "");
  const [text, setText] = useState(row.comment_text ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (state?.ok) setDirty(false); }, [state]);
  const a = attendance(row);
  const h = homework(row);
  return (
    <form action={action} className="rc-row">
      <input type="hidden" name="id" value={row.id} />
      <div className="rc-row-who">
        <b>{row.name}</b>
        <div className="sub mono" style={{ fontSize: 11.5 }}>{row.reg_no}</div>
        <a href={`/report-cards/view?student=${row.student_id}&month=${month}`} style={{ fontSize: 12 }}>View card</a>
      </div>
      <div className="rc-row-figs">
        <div><span className="lbl">Marks</span>{row.avg_pct != null ? <><b>{row.grade}</b> <span className="sub">{Number(row.avg_pct).toFixed(1)}%</span></> : <span className="sub">None</span>}</div>
        <div><span className="lbl">Attendance</span>{a.pct != null ? <b>{a.pct}%</b> : <span className="sub">-</span>}</div>
        <div><span className="lbl">Homework</span>{h.pct != null ? <b>{h.pct}%</b> : null} <span className="sub">{h.text}</span></div>
      </div>
      <div className="rc-row-com">
        <CommentSelect name="c1" value={c1} comments={comments} disabled={!canEdit} placeholder="Choose a comment…" exclude={c2}
          onChange={(v) => { setC1(v); if (!v) setC2(""); setDirty(true); }} />
        {/* A second comment is optional; its box appears once the first is chosen. */}
        {c1 ? (
          <CommentSelect name="c2" value={c2} comments={comments} disabled={!canEdit} placeholder="Add a second comment (optional)" exclude={c1}
            onChange={(v) => { setC2(v); setDirty(true); }} />
        ) : <input type="hidden" name="c2" value="" />}
        <input name="text" value={text} maxLength={500} placeholder="Your own note (optional)" style={input} disabled={!canEdit}
          onChange={(e) => { setText(e.target.value); setDirty(true); }} />
        {canEdit && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={pending || !dirty} style={{ fontSize: 12, padding: "7px 12px" }}>{pending ? "Saving…" : "Save"}</button>
            {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
            {state?.ok && !dirty && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
          </div>
        )}
      </div>
    </form>
  );
}

/** Homework set this month: counted from the Homework page (homework due in the month). */
function HomeworkSet({ value, fromTasks }: { value: number | null; fromTasks: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
      <span className="lbl" style={{ margin: 0 }}>Homework set this month</span>
      <b className="mono" style={{ color: "var(--ink)" }}>{value ?? 0}</b>
      <span className="sub">
        {fromTasks
          ? "From the Homework page: homework for this batch due this month. Completion = each student's submissions, late ones included."
          : value != null
            ? "Entered earlier on this page. From now on it is counted from the Homework page."
            : "No homework for this batch is due this month on the Homework page."}
      </span>
    </div>
  );
}

/** A batch's report card rows for one month: homework set count, then each student's figures with
 * the teacher's comments (up to 2 from the list, plus an optional note). */
export default function BatchEditor({ month, setCount, setFromTasks, rows, comments, canEdit }: {
  batch: string; month: string; setCount: number | null; setFromTasks: boolean; rows: RcBatchRow[]; comments: RcComment[]; canEdit: boolean;
}) {
  return (
    <>
      <HomeworkSet value={setCount} fromTasks={setFromTasks} />
      {rows.map((r) => <Row key={r.id} row={r} comments={comments} canEdit={canEdit} month={month} />)}
    </>
  );
}
