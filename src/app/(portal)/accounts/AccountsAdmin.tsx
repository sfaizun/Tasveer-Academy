"use client";
import { useActionState, useState } from "react";
import { createStudentLogin, createTeacherLogin, resetLoginPassword, setAppUserActive } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type PersonOption = { id: string; label: string };
type AppUserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_owner: boolean;
  active: boolean;
};

function CredentialResult({ email, password }: { email: string; password: string }) {
  return (
    <div
      style={{
        background: "var(--tint)", border: "1px solid var(--line)", borderRadius: 8,
        padding: "12px 14px", fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 600 }}>Login created — share these now, they won&apos;t be shown again:</div>
      <div className="mono">Email: <b>{email}</b></div>
      <div className="mono">Password: <b>{password}</b></div>
    </div>
  );
}

function CreateTeacherLoginForm({ teachers }: { teachers: PersonOption[] }) {
  const [state, action, pending] = useActionState(createTeacherLogin, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Teacher</label>
          <select style={inputStyle} name="teacher_id" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Login email</label>
          <input style={inputStyle} type="email" name="email" required placeholder="teacher@example.com" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Creating…" : "Create login"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
      {state?.ok && state.email && state.password && <CredentialResult email={state.email} password={state.password} />}
      {teachers.length === 0 && <div className="sub">Every active teacher already has a login.</div>}
    </form>
  );
}

function CreateStudentLoginForm({ students }: { students: PersonOption[] }) {
  const [state, action, pending] = useActionState(createStudentLogin, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Student</label>
          <select style={inputStyle} name="student_id" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Login email</label>
          <input style={inputStyle} type="email" name="email" required placeholder="student@example.com" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Creating…" : "Create login"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
      {state?.ok && state.email && state.password && <CredentialResult email={state.email} password={state.password} />}
      {students.length === 0 && <div className="sub">Every active student already has a login.</div>}
    </form>
  );
}

function ResetPasswordRow({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resetLoginPassword, null);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {!open ? (
        <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(true)}>
          Reset password
        </button>
      ) : (
        <form action={action} style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
          <input type="hidden" name="email" value={email} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 10px" }}>
              {pending ? "Resetting…" : "Confirm reset"}
            </button>
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
          {state?.ok && state.password && <CredentialResult email={state.email ?? email} password={state.password} />}
        </form>
      )}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Teacher";
  if (role === "student") return "Student";
  if (role === "guardian") return "Guardian";
  return role;
}

export default function AccountsAdmin({
  teachersWithoutLogin,
  studentsWithoutLogin,
  accounts,
  isOwner,
}: {
  teachersWithoutLogin: PersonOption[];
  studentsWithoutLogin: PersonOption[];
  accounts: AppUserRow[];
  isOwner: boolean;
}) {
  return (
    <>
      <div className="panel">
        <div className="phead">
          <div className="ptitle">Give a teacher a login</div>
        </div>
        <div style={{ padding: 16 }}>
          <CreateTeacherLoginForm teachers={teachersWithoutLogin} />
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Give a student a login</div>
        </div>
        <div style={{ padding: 16 }}>
          <CreateStudentLoginForm students={studentsWithoutLogin} />
        </div>
      </div>

      <div className="panel" style={{ borderLeft: "3px solid var(--amber, var(--line))" }}>
        <div style={{ padding: 16 }}>
          <div className="sub">
            Guardian logins aren&apos;t available here yet — a guardian account currently doesn&apos;t
            get linked to their child&apos;s record automatically, so creating one would sign in to an
            empty portal. Ask to have this wired up before using guardian accounts.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Existing accounts</div>
          <div className="sub">{accounts.length} total</div>
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.full_name}</b>{a.is_owner && <span className="sub"> (owner)</span>}</td>
                  <td className="mono sub">{a.email ?? "—"}</td>
                  <td className="sub">{roleLabel(a.role)}</td>
                  <td>
                    {a.active
                      ? <span className="st paid"><span className="dot" />Active</span>
                      : <span className="st over"><span className="dot" />Deactivated</span>}
                  </td>
                  <td className="n">
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {a.email && <ResetPasswordRow email={a.email} />}
                      {isOwner && !a.is_owner && (
                        <form action={setAppUserActive}>
                          <input type="hidden" name="id" value={a.id} />
                          <input type="hidden" name="active" value={String(!a.active)} />
                          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                            {a.active ? "Deactivate" : "Reactivate"}
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr><td colSpan={5} className="sub">No accounts yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
