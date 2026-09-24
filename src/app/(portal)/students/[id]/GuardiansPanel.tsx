"use client";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import Req from "@/components/Req";
import { addGuardian, updateGuardian, removeGuardian } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

const RELATION_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "father", label: "Father" },
  { value: "mother", label: "Mother" },
  { value: "other", label: "Other" },
];

export type Guardian = {
  id: string;
  full_name: string;
  relation: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_primary: boolean;
};

function GuardianFields({ guardian }: { guardian?: Guardian }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
      <div className="field">
        <label className="lbl">Name<Req /></label>
        <input style={inputStyle} type="text" name="full_name" defaultValue={guardian?.full_name ?? ""} required />
      </div>
      <div className="field">
        <label className="lbl">Relation</label>
        <select style={inputStyle} name="relation" defaultValue={guardian?.relation ?? ""}>
          {RELATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="lbl">Phone</label>
        <input style={inputStyle} type="text" name="phone" defaultValue={guardian?.phone ?? ""} />
      </div>
      <div className="field">
        <label className="lbl">Email</label>
        <input style={inputStyle} type="email" name="email" defaultValue={guardian?.email ?? ""} />
      </div>
      <div className="field" style={{ gridColumn: "1 / -1" }}>
        <label className="lbl">Address</label>
        <input style={inputStyle} type="text" name="address" defaultValue={guardian?.address ?? ""} />
      </div>
      <div className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" name="is_primary" defaultChecked={guardian?.is_primary ?? false} id={`primary-${guardian?.id ?? "new"}`} />
        <label className="lbl" htmlFor={`primary-${guardian?.id ?? "new"}`} style={{ marginBottom: 0 }}>Primary guardian</label>
      </div>
    </div>
  );
}

function EditGuardianForm({ studentId, guardian, onDone }: { studentId: string; guardian: Guardian; onDone: () => void }) {
  const [state, action, pending] = useActionState(updateGuardian, null);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="guardian_id" value={guardian.id} />
      <GuardianFields guardian={guardian} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "8px 14px" }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onDone}>
          Close
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

function RemoveGuardianForm({ studentId, guardian }: { studentId: string; guardian: Guardian }) {
  const [state, action, pending] = useActionState(removeGuardian, null);
  return (
    <form action={action} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <input type="hidden" name="guardian_id" value={guardian.id} />
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, color: "var(--crit)" }}>
        {pending ? "Removing…" : "Remove guardian"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

function AddGuardianForm({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(addGuardian, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
  }, [state, onDone]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <GuardianFields />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "8px 14px" }}>
          {pending ? "Adding…" : "+ Add guardian"}
        </button>
        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "8px 14px" }} onClick={onDone}>
          Cancel
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
    </form>
  );
}

/** Admin-only editing of guardian rows on the student detail page — mirrors the Subjects
 * panel's "Manage" toggle: the read-only table is the default, with each row expandable
 * into an edit form and a plain "Add guardian" form beneath. Most students have exactly
 * one guardian, but the schema (and this UI) supports more than one. */
export default function GuardiansPanel({ studentId, guardians, canEdit }: { studentId: string; guardians: Guardian[]; canEdit: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  if (!canEdit && guardians.length === 0) return null;

  return (
    <div className="panel">
      <div className="phead"><div className="ptitle">Guardian</div></div>
      {guardians.length > 0 && (
        <div className="tblwrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Relation</th><th>Phone</th><th>Email</th>{canEdit && <th className="n"></th>}</tr>
            </thead>
            <tbody>
              {guardians.map((g) => {
                const isOpen = open === g.id;
                return (
                  <Fragment key={g.id}>
                    <tr>
                      <td><b>{g.full_name}</b>{g.is_primary && <span className="sub"> (primary)</span>}</td>
                      <td className="sub">{g.relation ?? "—"}</td>
                      <td className="sub">{g.phone ?? "—"}</td>
                      <td className="sub">{g.email ?? "—"}</td>
                      {canEdit && (
                        <td className="n">
                          <button
                            className="btn ghost"
                            type="button"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            onClick={() => setOpen(isOpen ? null : g.id)}
                          >
                            {isOpen ? "Close" : "Manage"}
                          </button>
                        </td>
                      )}
                    </tr>
                    {isOpen && canEdit && (
                      <tr>
                        <td colSpan={5} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            <EditGuardianForm studentId={studentId} guardian={g} onDone={() => setOpen(null)} />
                            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                              <RemoveGuardianForm studentId={studentId} guardian={g} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <div style={{ padding: 16, borderTop: guardians.length > 0 ? "1px solid var(--line)" : "none" }}>
          {adding ? (
            <>
              <div className="lbl" style={{ marginBottom: 8 }}>Add a guardian</div>
              <AddGuardianForm studentId={studentId} onDone={() => setAdding(false)} />
            </>
          ) : (
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 11px" }} onClick={() => setAdding(true)}>
              + Add guardian
            </button>
          )}
        </div>
      )}
    </div>
  );
}
