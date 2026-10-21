"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { issueIdCard, recordIdCardPrint } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

/** Create the card (no card yet) or reissue it with a reason (lost or damaged card). */
export function IssueCard({ studentId, hasCard }: { studentId: string; hasCard: boolean }) {
  const [state, action, pending] = useActionState(issueIdCard, null);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  if (!hasCard) {
    return (
      <form action={action} style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="student_id" value={studentId} />
        <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create ID card"}</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </form>
    );
  }
  return open ? (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: "100%" }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input name="reason" required maxLength={300} placeholder="Reason, e.g. card lost" aria-label="Reason for reissuing" style={{ ...input, flex: "1 1 200px" }} />
      <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Reissue card"}</button>
      <button className="btn ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  ) : (
    <button className="btn ghost" type="button" onClick={() => setOpen(true)}>Reissue card</button>
  );
}

/** Counts the print, then opens the browser's print dialog (choose "Save as PDF" for a file). */
export function PrintCard({ cardId }: { cardId: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn" type="button" disabled={pending} onClick={() => start(async () => { await recordIdCardPrint(cardId); window.print(); })}>
      Print / Save as PDF
    </button>
  );
}
