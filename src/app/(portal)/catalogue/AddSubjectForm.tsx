"use client";
import { useActionState, useRef, useEffect, useState } from "react";
import { addSubject } from "./actions";

const selStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "10px 12px",
  fontSize: 14, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

export default function AddSubjectForm({
  programmeId,
  needsLevel,
}: {
  programmeId: string;
  needsLevel: boolean;
}) {
  const [state, action, pending] = useActionState(addSubject, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [level, setLevel] = useState("");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setLevel("");
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <input type="hidden" name="programme_id" value={programmeId} />
      <div className="field" style={{ minWidth: 180, flex: "1 1 180px" }}>
        <label className="lbl">Subject name</label>
        <input name="name" type="text" required />
      </div>
      {needsLevel && (
        <div className="field" style={{ minWidth: 120 }}>
          <label className="lbl">Level</label>
          <select style={selStyle} name="level" value={level} onChange={(e) => setLevel(e.target.value)} required>
            <option value="">Choose…</option>
            <option value="as">AS</option>
            <option value="a2">A2</option>
          </select>
        </div>
      )}
      <button className="btn ghost" type="submit" disabled={pending}>
        {pending ? "Adding…" : "+ Add subject"}
      </button>
      {state?.error && <div className="sub" style={{ color: "var(--crit)", flexBasis: "100%" }}>{state.error}</div>}
    </form>
  );
}
