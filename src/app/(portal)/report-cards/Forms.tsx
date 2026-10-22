"use client";
import { useActionState, useState } from "react";
import Req from "@/components/Req";
import { generateReportCards, saveCommentOption } from "./actions";
import { CATEGORIES, type RcComment } from "./shared";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** "Generate report cards" for the month (everyone, or one batch). */
export function GenerateButton({ month, batch, label }: { month: string; batch?: string; label: string }) {
  const [state, action, pending] = useActionState(generateReportCards, null);
  return (
    <form action={action} style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="month" value={month} />
      {batch && <input type="hidden" name="batch" value={batch} />}
      <button className="btn" type="submit" disabled={pending}>{pending ? "Generating…" : label}</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>{state.message}</span>}
    </form>
  );
}

function OptionRow({ c }: { c: RcComment }) {
  const [state, action, pending] = useActionState(saveCommentOption, null);
  return (
    <form action={action} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px auto auto", gap: 8, alignItems: "center", padding: "8px 18px", borderTop: "1px solid var(--line)" }} className="rc-opt">
      <input type="hidden" name="id" value={c.id} />
      <input name="text" defaultValue={c.text} maxLength={300} required style={{ ...input, opacity: c.active ? 1 : 0.55 }} />
      <select name="category" defaultValue={c.category} style={input}>
        {CATEGORIES.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
      </select>
      <select name="active" defaultValue={c.active ? "1" : "0"} style={input}>
        <option value="1">In use</option>
        <option value="0">Retired</option>
      </select>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, padding: "7px 10px" }}>{pending ? "…" : "Save"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved</span>}
      </div>
    </form>
  );
}

/** Office: the comment list teachers choose from. Retired comments stay on cards that used them. */
export function CommentListEditor({ comments }: { comments: RcComment[] }) {
  const [state, action, pending] = useActionState(saveCommentOption, null);
  const [key, setKey] = useState(0);
  return (
    <>
      {CATEGORIES.map((k) => (
        <div key={k.key}>
          <div className="lbl" style={{ padding: "12px 18px 4px" }}>{k.label}</div>
          {comments.filter((c) => c.category === k.key).map((c) => <OptionRow key={c.id} c={c} />)}
        </div>
      ))}
      <form key={key} action={async (f) => { await action(f); setKey((n) => n + 1); }}
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px auto", gap: 8, alignItems: "end", padding: "14px 18px", borderTop: "1px solid var(--line)" }} className="rc-opt">
        <div className="field">
          <label className="lbl" htmlFor="rc-new">New comment<Req /></label>
          <input id="rc-new" name="text" maxLength={300} required style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="rc-new-cat">Group<Req /></label>
          <select id="rc-new-cat" name="category" defaultValue="good" style={input}>
            {CATEGORIES.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </div>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add comment"}</button>
      </form>
      {state?.error && <div className="sub" style={{ color: "var(--crit)", padding: "0 18px 12px" }}>{state.error}</div>}
    </>
  );
}
