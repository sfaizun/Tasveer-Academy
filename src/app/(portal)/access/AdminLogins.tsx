"use client";
import { useActionState, useEffect, useRef } from "react";
import { createAdminLogin, setUserRole } from "./actions";

export type AdminUser = { id: string; full_name: string; email: string | null; is_owner: boolean; active: boolean; admin_role_id: string | null };
type RoleOpt = { id: string; name: string };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};

function RoleSelect({ user, roles, isMe }: { user: AdminUser; roles: RoleOpt[]; isMe: boolean }) {
  const [state, action, pending] = useActionState(setUserRole, null);
  if (user.is_owner) return <span>Super Admin <span className="sub">(owner, always full access)</span></span>;
  if (isMe) return <span>{roles.find((r) => r.id === user.admin_role_id)?.name ?? "No access"} <span className="sub">(you can&apos;t change your own)</span></span>;
  return (
    <form action={action} style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="user_id" value={user.id} />
      <select
        name="role_id"
        defaultValue={user.admin_role_id ?? ""}
        style={inputStyle}
        aria-label={`Access role for ${user.full_name}`}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={pending}
      >
        <option value="">No access</option>
        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      {pending && <span className="sub">Saving…</span>}
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && !pending && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
    </form>
  );
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

/** Admin logins and the access role each one has. */
export default function AdminLogins({ users, roles, meId }: { users: AdminUser[]; roles: RoleOpt[]; meId: string }) {
  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Admin logins</div>
        <div className="sub">Choose each admin&apos;s access role. It saves as soon as you pick one.</div>
      </div>
      <div className="tblwrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Access role</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.active ? undefined : { opacity: 0.55 }}>
                <td><b style={{ color: "var(--ink)" }}>{u.full_name}</b>{!u.active && <span className="sub"> · deactivated</span>}</td>
                <td className="sub">{u.email ?? "—"}</td>
                <td><RoleSelect user={u} roles={roles} isMe={u.id === meId} /></td>
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
