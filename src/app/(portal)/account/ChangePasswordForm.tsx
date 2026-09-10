"use client";
import { useActionState, useRef, useEffect } from "react";
import { changePassword } from "./actions";
import Req from "@/components/Req";

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 360 }}>
      <div className="field">
        <label className="lbl" htmlFor="current_password">Current password<Req /></label>
        <input id="current_password" name="current_password" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="new_password">New password<Req /></label>
        <input id="new_password" name="new_password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="confirm_password">Confirm new password<Req /></label>
        <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required minLength={8} />
      </div>

      {state?.error && (
        <div
          role="alert"
          style={{
            background: "var(--crit-soft)", color: "var(--crit)",
            border: "1px solid var(--crit-soft)", borderRadius: 7,
            padding: "10px 12px", fontSize: 13,
          }}
        >
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div
          style={{
            background: "var(--ok-soft)", color: "var(--ok)",
            border: "1px solid var(--ok-soft)", borderRadius: 7,
            padding: "10px 12px", fontSize: 13,
          }}
        >
          Password updated.
        </div>
      )}

      <button className="btn" type="submit" disabled={pending} style={{ justifyContent: "center", padding: "11px 15px" }}>
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
