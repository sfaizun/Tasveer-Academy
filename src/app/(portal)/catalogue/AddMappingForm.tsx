"use client";
import { useActionState, useRef, useEffect } from "react";
import { addMapping } from "./actions";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px",
  fontSize: 12.5, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%", maxWidth: 240,
};

export default function AddMappingForm({
  teacherId,
  options,
}: {
  teacherId: string;
  options: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addMapping, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  if (options.length === 0) return null;

  return (
    <form ref={formRef} action={action} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
      <input type="hidden" name="teacher_id" value={teacherId} />
      <select style={selStyle} name="subject_id" required defaultValue="">
        <option value="" disabled>
          + Map a subject…
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <button className="btn ghost" type="submit" disabled={pending} style={{ padding: "6px 10px", fontSize: 12 }}>
        {pending ? "…" : "Add"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}
