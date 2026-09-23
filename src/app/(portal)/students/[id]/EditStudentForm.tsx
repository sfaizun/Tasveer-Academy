"use client";
import { useActionState, useState } from "react";
import Req from "@/components/Req";
import { updateStudentDetails } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "undisclosed", label: "Prefer not to say" },
];

export type StudentDetails = {
  full_name: string;
  previous_reg_no: string | null;
  gender: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  school_name: string | null;
  admitted_on: string | null;
};

/** Everything on the "Student" info panel is editable here except reg_no (permanent — the
 * student's reference number, never changed once admitted) and status (its own "Change
 * status" control just below this). Collapsed behind an "Edit details" toggle, same pattern
 * as the per-subject "Manage" expansion on the Subjects panel, so the read-only view stays
 * the default and editing is a deliberate extra step. */
export default function EditStudentForm({ studentId, details }: { studentId: string; details: StudentDetails }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateStudentDetails, null);

  if (!open) {
    return (
      <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 11px" }} onClick={() => setOpen(true)}>
        Edit details
      </button>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="student_id" value={studentId} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Full name<Req /></label>
          <input style={inputStyle} type="text" name="full_name" defaultValue={details.full_name} required />
        </div>
        <div className="field">
          <label className="lbl">Previous reg. no.</label>
          <input style={inputStyle} type="text" name="previous_reg_no" defaultValue={details.previous_reg_no ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">Gender</label>
          <select style={inputStyle} name="gender" defaultValue={details.gender ?? ""}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Nationality</label>
          <input style={inputStyle} type="text" name="nationality" defaultValue={details.nationality ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">WhatsApp / mobile</label>
          <input style={inputStyle} type="text" name="phone" defaultValue={details.phone ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">Email</label>
          <input style={inputStyle} type="email" name="email" defaultValue={details.email ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">School</label>
          <input style={inputStyle} type="text" name="school_name" defaultValue={details.school_name ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">Admitted on</label>
          <input style={inputStyle} type="date" name="admitted_on" defaultValue={details.admitted_on ?? ""} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label className="lbl">Address</label>
          <input style={inputStyle} type="text" name="address" defaultValue={details.address ?? ""} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "8px 14px" }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="btn ghost"
          type="button"
          style={{ fontSize: 12, padding: "8px 14px" }}
          onClick={() => setOpen(false)}
        >
          Close
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
      </div>
    </form>
  );
}
