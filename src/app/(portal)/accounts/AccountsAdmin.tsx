"use client";
import { useActionState, useEffect, useMemo, useState } from "react";
import { startViewAs } from "../view-as-actions";
import { createCanteenLogin, createStudentLogin, createTeacherLogin, resetLoginPassword, setAppUserActive, setLoginRoles } from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type PersonOption = { id: string; label: string; email?: string | null };
type AppUserRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  is_owner: boolean;
  active: boolean;
  /** Access roles held (Academy > Access). */
  role_ids: string[];
  is_teacher: boolean; // linked to a teacher record
};
export type RoleOption = { id: string; name: string; is_super: boolean; read_only?: boolean };

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

function CreateCanteenLoginForm() {
  const [state, action, pending] = useActionState(createCanteenLogin, null);

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Manager&apos;s name</label>
          <input style={inputStyle} type="text" name="full_name" required placeholder="e.g. Rahim Uddin" />
        </div>
        <div className="field">
          <label className="lbl">Login email</label>
          <input style={inputStyle} type="email" name="email" required placeholder="canteen@example.com" />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Creating…" : "Create login"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>
      {state?.ok && state.email && state.password && <CredentialResult email={state.email} password={state.password} />}
      <div className="sub">This login only sees the canteen: menu, prices, photos and opening hours. It cannot see students, fees or anything else in the academy.</div>
    </form>
  );
}

function CreateStudentLoginForm({ students }: { students: PersonOption[] }) {
  const [state, action, pending] = useActionState(createStudentLogin, null);
  // The login email starts as the email given at admission; admin can still change it.
  const [loginEmail, setLoginEmail] = useState("");

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Student</label>
          <select
            style={inputStyle} name="student_id" required defaultValue=""
            onChange={(e) => setLoginEmail(students.find((s) => s.id === e.target.value)?.email ?? "")}
          >
            <option value="" disabled>Choose…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Login email</label>
          <input
            style={inputStyle} type="email" name="email" required placeholder="student@example.com"
            value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
          />
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

/** Super Admin: see the portal exactly as this login sees it (nothing can be changed meanwhile). */
function ViewAsButton({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(startViewAs, null);
  return (
    <form action={action} style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <input type="hidden" name="user_id" value={id} />
      <button className="btn ghost" type="submit" disabled={pending} title={`See the portal as ${name} sees it`} style={{ fontSize: 12, padding: "6px 10px" }}>
        {pending ? "Opening…" : "View as"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
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

/** The access roles a login carries on top of its own portal (owner: always Super Admin). */
function accessLabel(a: AppUserRow, roles: RoleOption[]) {
  const names = roles.filter((r) => a.role_ids.includes(r.id)).map(roleName);
  if (a.is_owner && !roles.some((r) => r.is_super && a.role_ids.includes(r.id))) names.unshift("Super Admin");
  if (a.is_owner) return names.join(", ") + " (owner)";
  if (names.length) return names.join(", ");
  return a.role === "admin" ? "No access set" : "None";
}
const roleName = (r: RoleOption) => r.name + (r.read_only ? " (view only)" : "");
const holds = (a: AppUserRow, id: string, superId?: string) =>
  id === "none" ? !a.is_owner && a.role_ids.length === 0 : a.role_ids.includes(id) || (a.is_owner && id === superId);
const canHaveRole = (a: AppUserRow) => !a.is_owner && a.role !== "student" && a.role !== "guardian";

/** Tick the access roles a login holds. With more than one, they pick which to use from the
 * "Viewing as" menu at the top of the portal. */
function AccessRoles({ a, roles, isMe }: { a: AppUserRow; roles: RoleOption[]; isMe: boolean }) {
  const [state, action, pending] = useActionState(setLoginRoles, null);
  const [open, setOpen] = useState(false);
  // Close the list once it has saved.
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  if (isMe) return <span className="sub">{accessLabel(a, roles)} (you can&apos;t change your own)</span>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span>{accessLabel(a, roles)}</span>
        <button className="btn ghost" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ fontSize: 12, padding: "4px 10px" }}>
          {open ? "Close" : "Change"}
        </button>
        {state?.ok && !pending && !open && <span className="sub" style={{ color: "var(--ok)" }}>Saved</span>}
      </div>
      {open && (
        <form
          action={action}
          style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--tint)", minWidth: 200 }}
        >
          <input type="hidden" name="user_id" value={a.id} />
          {roles.map((r) => (
            <label key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="role_id" value={r.id} defaultChecked={a.role_ids.includes(r.id)} />
              {roleName(r)}
            </label>
          ))}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}>
              {pending ? "Saving…" : "Save"}
            </button>
            <span className="sub">None ticked: {a.role === "admin" ? "no access" : "own portal only"}</span>
          </div>
        </form>
      )}
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Teacher";
  if (role === "student") return "Student";
  if (role === "guardian") return "Guardian";
  if (role === "canteen_manager") return "Canteen manager";
  return role;
}

export default function AccountsAdmin({
  teachersWithoutLogin,
  studentsWithoutLogin,
  accounts,
  isOwner,
  roles = [],
  canManageAccess = false,
  meId = "",
  canViewAs = false,
}: {
  teachersWithoutLogin: PersonOption[];
  studentsWithoutLogin: PersonOption[];
  accounts: AppUserRow[];
  isOwner: boolean;
  roles?: RoleOption[];
  canManageAccess?: boolean;
  meId?: string;
  /** Super Admin: may view the portal as any other login. */
  canViewAs?: boolean;
}) {
  const [roleFilter, setRoleFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const superId = roles.find((r) => r.is_super)?.id;
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter && !holds(a, roleFilter, superId)) return false;
      if (typeFilter && a.role !== typeFilter) return false;
      if (statusFilter === "active" && !a.active) return false;
      if (statusFilter === "inactive" && a.active) return false;
      if (needle && !`${a.full_name} ${a.email ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [accounts, superId, roleFilter, typeFilter, statusFilter, q]);
  const countFor = (key: string) => accounts.filter((a) => holds(a, key, superId)).length;
  const countType = (t: string) => accounts.filter((a) => a.role === t).length;
  const filterStyle: React.CSSProperties = { ...inputStyle, width: "auto", minWidth: 170, padding: "8px 10px", fontSize: 12.5 };

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

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Give the canteen manager a login</div>
        </div>
        <div style={{ padding: 16 }}>
          <CreateCanteenLoginForm />
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Existing accounts</div>
          <div className="sub">{shown.length === accounts.length ? `${accounts.length} total` : `${shown.length} of ${accounts.length}`}</div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 16px 4px" }}>
          <div className="field">
            <label className="lbl" htmlFor="acc-role">Access role</label>
            <select id="acc-role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={filterStyle}>
              <option value="">All access roles</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{roleName(r)} ({countFor(r.id)})</option>)}
              <option value="none">No access role ({countFor("none")})</option>
            </select>
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-type">Login type</label>
            <select id="acc-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={filterStyle}>
              <option value="">All logins</option>
              {(["admin", "teacher", "student", "guardian", "canteen_manager"] as const).map((k) =>
                countType(k) > 0 ? <option key={k} value={k}>{roleLabel(k)} ({countType(k)})</option> : null
              )}
            </select>
          </div>
          <div className="field">
            <label className="lbl" htmlFor="acc-status">Status</label>
            <select id="acc-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterStyle}>
              <option value="">Active and deactivated</option>
              <option value="active">Active</option>
              <option value="inactive">Deactivated</option>
            </select>
          </div>
          <div className="field" style={{ flex: "1 1 200px" }}>
            <label className="lbl" htmlFor="acc-q">Search</label>
            <input id="acc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or email" style={{ ...inputStyle, padding: "8px 10px", fontSize: 12.5 }} />
          </div>
          {(roleFilter || typeFilter || statusFilter || q) && (
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => { setRoleFilter(""); setTypeFilter(""); setStatusFilter(""); setQ(""); }}>
              Clear
            </button>
          )}
        </div>
        {canManageAccess && (
          <div className="sub" style={{ padding: "6px 16px 10px" }}>
            Everyone keeps their own portal (teacher, student, canteen). Each access role adds a view with the sections
            ticked for it on Academy &gt; Access; anyone with more than one view switches between them from the
            &quot;Viewing as&quot; menu at the top of the portal. Students and guardians can&apos;t be given one.
          </div>
        )}
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Login</th>
                <th>Access roles</th>
                <th>Status</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.full_name}</b>{a.is_owner && <span className="sub"> (owner)</span>}</td>
                  <td className="mono sub">{a.email ?? "—"}</td>
                  <td className="sub">{roleLabel(a.role)}</td>
                  <td>
                    {canManageAccess && canHaveRole(a) ? (
                      <AccessRoles a={a} roles={roles} isMe={a.id === meId} />
                    ) : (
                      <span className="sub">{a.role === "student" || a.role === "guardian" ? "—" : accessLabel(a, roles)}</span>
                    )}
                  </td>
                  <td>
                    {a.active
                      ? <span className="st paid"><span className="dot" />Active</span>
                      : <span className="st over"><span className="dot" />Deactivated</span>}
                  </td>
                  <td className="n">
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {canViewAs && a.active && a.id !== meId && <ViewAsButton id={a.id} name={a.full_name} />}
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
              {shown.length === 0 && (
                <tr><td colSpan={6} className="sub">{accounts.length ? "No accounts match these filters." : "No accounts yet."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
