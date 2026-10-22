"use client";
import { useActionState, useEffect, useState } from "react";
import Req from "@/components/Req";
import { updateMyGuardian, updateMyProfile } from "./actions";

const input: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px", fontSize: 13,
  background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit", width: "100%",
};
const grid: React.CSSProperties = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" };

export type MyDetails = {
  full_name: string; gender: string | null; date_of_birth: string | null; nationality: string | null;
  phone: string | null; email: string | null; school_name: string | null; address: string | null;
};
export type MyGuardian = { id: string; full_name: string; relation: string | null; phone: string | null; email: string | null; address: string | null; is_primary: boolean };

const GENDERS = [["male", "Male"], ["female", "Female"], ["other", "Other"], ["undisclosed", "Prefer not to say"]];
const RELATIONS = [["father", "Father"], ["mother", "Mother"], ["guardian", "Guardian"], ["other", "Other"]];

function Status({ state, pending, dirty }: { state: { ok?: boolean; error?: string } | null; pending: boolean; dirty: boolean }) {
  if (state?.error) return <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>;
  if (state?.ok && !dirty && !pending) return <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>;
  return null;
}

/** The student's own details. Student ID and admission date are shown above and can't be changed here. */
export function MyDetailsForm({ d, today }: { d: MyDetails; today: string }) {
  const [state, action, pending] = useActionState(updateMyProfile, null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (state?.ok) setDirty(false); }, [state]);
  return (
    <form action={action} onChange={() => setDirty(true)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={grid}>
        <div className="field">
          <label className="lbl" htmlFor="mp-name">Full name<Req /></label>
          <input id="mp-name" name="full_name" required maxLength={200} defaultValue={d.full_name} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-gender">Gender<Req /></label>
          <select id="mp-gender" name="gender" required defaultValue={d.gender ?? ""} style={input}>
            <option value="" disabled>Choose…</option>
            {GENDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-dob">Date of birth</label>
          <input id="mp-dob" type="date" name="date_of_birth" max={today} defaultValue={d.date_of_birth ?? ""} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-nat">Nationality</label>
          <input id="mp-nat" name="nationality" maxLength={60} defaultValue={d.nationality ?? ""} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-phone">WhatsApp / mobile<Req /></label>
          <input id="mp-phone" type="tel" inputMode="tel" name="phone" required placeholder="01XXXXXXXXX" defaultValue={d.phone ?? ""} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-email">Email<Req /></label>
          <input id="mp-email" type="email" name="email" required defaultValue={d.email ?? ""} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="mp-school">School<Req /></label>
          <input id="mp-school" name="school_name" required maxLength={200} defaultValue={d.school_name ?? ""} style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor="mp-addr">Address<Req /></label>
          <input id="mp-addr" name="address" required maxLength={500} defaultValue={d.address ?? ""} style={input} />
        </div>
      </div>
      <div className="sub">Changing your email here doesn&apos;t change the email you sign in with. Ask the office for that.</div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save my details"}</button>
        <Status state={state} pending={pending} dirty={dirty} />
      </div>
    </form>
  );
}

export function MyGuardianForm({ g }: { g: MyGuardian }) {
  const [state, action, pending] = useActionState(updateMyGuardian, null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (state?.ok) setDirty(false); }, [state]);
  const id = g.id.slice(0, 8);
  return (
    <form action={action} onChange={() => setDirty(true)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="id" value={g.id} />
      <div style={grid}>
        <div className="field">
          <label className="lbl" htmlFor={`g-n-${id}`}>Name<Req /></label>
          <input id={`g-n-${id}`} name="full_name" required maxLength={200} defaultValue={g.full_name} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`g-r-${id}`}>Relation<Req /></label>
          <select id={`g-r-${id}`} name="relation" required defaultValue={g.relation ?? ""} style={input}>
            <option value="" disabled>Choose…</option>
            {RELATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`g-p-${id}`}>Phone<Req /></label>
          <input id={`g-p-${id}`} type="tel" inputMode="tel" name="phone" required placeholder="01XXXXXXXXX" defaultValue={g.phone ?? ""} style={input} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor={`g-e-${id}`}>Email</label>
          <input id={`g-e-${id}`} type="email" name="email" defaultValue={g.email ?? ""} style={input} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl" htmlFor={`g-a-${id}`}>Address</label>
          <input id={`g-a-${id}`} name="address" maxLength={500} defaultValue={g.address ?? ""} style={input} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn ghost" type="submit" disabled={pending}>{pending ? "Saving…" : "Save guardian"}</button>
        <Status state={state} pending={pending} dirty={dirty} />
      </div>
    </form>
  );
}
