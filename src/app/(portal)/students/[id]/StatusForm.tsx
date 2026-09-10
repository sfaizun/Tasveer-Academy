"use client";
import { useActionState, useEffect } from "react";
import { setStudentStatus } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 10px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit",
};

const STATUS_OPTIONS = [
  { value: "applicant", label: "Applicant" },
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
  { value: "alumni", label: "Alumni" },
];

export default function StatusForm({ studentId, status }: { studentId: string; status: string }) {
  const [state, action, pending] = useActionState(setStudentStatus, null);

  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <select style={inputStyle} name="status" defaultValue={status}>
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, padding: "7px 11px" }}>
        {pending ? "Saving…" : "Update status"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
    </form>
  );
}
