"use client";
import { useActionState, useRef, useEffect } from "react";
import { addTeacher } from "./actions";
import Req from "@/components/Req";

export default function AddTeacherForm() {
  const [state, action, pending] = useActionState(addTeacher, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="field" style={{ minWidth: 180, flex: "1 1 180px" }}>
        <label className="lbl" htmlFor="t-name">Full name<Req /></label>
        <input id="t-name" name="full_name" type="text" required />
      </div>
      <div className="field" style={{ minWidth: 160, flex: "1 1 160px" }}>
        <label className="lbl" htmlFor="t-phone">Phone</label>
        <input id="t-phone" name="phone" type="text" />
      </div>
      <div className="field" style={{ minWidth: 180, flex: "1 1 180px" }}>
        <label className="lbl" htmlFor="t-email">Email</label>
        <input id="t-email" name="email" type="email" />
      </div>
      <button className="btn" type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add teacher"}
      </button>
      {state?.error && <div className="sub" style={{ color: "var(--crit)", flexBasis: "100%" }}>{state.error}</div>}
    </form>
  );
}
