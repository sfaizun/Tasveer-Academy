"use client";
import { useActionState, useEffect, useRef } from "react";
import { createAdminLogin } from "./actions";

export type AdminUser = { id: string; full_name: string; email: string | null; is_owner: boolean; active: boolean; role_ids: string[]; role?: string };
const OWN: Record<string, string> = { teacher: "Teacher", canteen_manager: "Canteen manager" };
type RoleOpt = { id: string; name: string; is_super?: boolean; read_only?: boolean };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function rolesOf(user: AdminUser, roles: RoleOpt[]) {
  const names = roles.filter((r) => user.role_ids.includes(r.id)).map((r) => r.name + (r.read_only ? " (view only)" : ""));
  if (user.is_owner && !roles.some((r) => r.is_super && user.role_ids.includes(r.id))) names.unshift("Super Admin");
  return names.length ? names.join(", ") : "No access";
}

function CreateAdmin({ roles }: { roles: RoleOpt[] }) {
  const [state, action, pending] = useActionState(createAdminLogin, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok) ref.current?.reset(); }, [state]);
  return (
    <form ref={ref} action={action} style={{ display: "flex", flexDirection: "column", gap: 10, padding: "14px 18px 18px", borderTop: "1px solid var(--line)" }}>
      <div className="lbl">Add an admin login</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field"><label className="lbl" htmlFor="ad-name">Name</label><input id="ad-name" name="full_name" required style={{ ...inputStyle, minWidth: 200 }} /></div>
        <div className="field"><label className="lbl" htmlFor="ad-email">Email (login)</label><input id="ad-email" name="email" type="email" required style={{ ...inputStyle, minWidth: 240 }} /></div>
        <div className="field">
          <label className="lbl" htmlFor="ad-role">Access role</label>
          <select id="ad-role" name="role_id" required defaultValue="" style={{ ...inputStyle, minWidth: 180 }}>
            <option value="" disabled>Choose…</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "+ Create login"}</button>
      </div>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && state.email && state.password && (
        <div style={{ background: "var(--tint)", border: "1px solid var(--line)", borderRadius: 8, padding: "12px 14px", fontSize: 13 }}>
          <div style={{ marginBottom: 6, fontWeight: 600 }}>Login created. Share these now, they won&apos;t be shown again:</div>
          <div className="mono">Email: <b>{state.email}</b></div>
          <div className="mono">Password: <b>{state.password}</b></div>
        </div>
      )}
    </form>
  );
}

/** Admin logins and the access roles each one holds. Roles are changed on Academy > Accounts. */
export default function AdminLogins({ users, roles, meId }: { users: AdminUser[]; roles: RoleOpt[]; meId: string }) {
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Logins with admin access</div>
        <div className="sub">Admins, and teachers or the canteen manager with an access role. <a href="/accounts">Change roles on Accounts</a>.</div>
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Access roles</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.active ? undefined : { opacity: 0.55 }}>
                <td>
                  <b style={{ color: "var(--ink)" }}>{u.full_name}</b>
                  {u.role && OWN[u.role] && <span className="sub"> · {OWN[u.role]}</span>}
                  {!u.active && <span className="sub"> · deactivated</span>}
                </td>
                <td className="sub">{u.email ?? "—"}</td>
                <td>{rolesOf(u, roles)}{u.is_owner && <span className="sub"> (owner, always full access)</span>}{u.id === meId && <span className="sub"> (you)</span>}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={3} className="sub">No admin logins yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <CreateAdmin roles={roles} />
    </div>
  );
}
