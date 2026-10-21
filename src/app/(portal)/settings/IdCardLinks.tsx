"use client";
import { useActionState } from "react";
import { saveIdCardLinks } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};

/** The three links printed as QR codes on the back of every student ID card. Left empty, a code
 * is not printed. */
export default function IdCardLinks({ portal, facebook, instagram }: { portal: string; facebook: string; instagram: string }) {
  const [state, action, pending] = useActionState(saveIdCardLinks, null);
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">ID card links</div>
        <div className="sub">Printed as QR codes on the back of student ID cards. Leave one empty to leave its code off.</div>
      </div>
      <form action={action} style={{ padding: 18, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        <div className="field"><label className="lbl" htmlFor="l-portal">Portal app</label><input id="l-portal" name="portal_url" type="url" defaultValue={portal} placeholder="https://" style={input} /></div>
        <div className="field"><label className="lbl" htmlFor="l-fb">Facebook page</label><input id="l-fb" name="facebook_url" type="url" defaultValue={facebook} placeholder="https://facebook.com/..." style={input} /></div>
        <div className="field"><label className="lbl" htmlFor="l-ig">Instagram page</label><input id="l-ig" name="instagram_url" type="url" defaultValue={instagram} placeholder="https://instagram.com/..." style={input} /></div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save links"}</button>
          {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
          {state?.ok && !pending && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
        </div>
      </form>
    </div>
  );
}
