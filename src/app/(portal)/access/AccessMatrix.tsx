"use client";
import { Fragment, useActionState, useEffect, useMemo, useState } from "react";
import { ASSIGNABLE_PAGES, FEE_PAGES, PAGES } from "@/lib/access";
import { addRole, removeRoleChecked, saveMatrix } from "./actions";

export type RoleRow = { id: string; name: string; pages: string[]; is_super: boolean; is_system: boolean; read_only: boolean; users: number };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit",
};
const GROUPS = [...new Set(PAGES.map((p) => p.group))];

function RemoveRole({ role }: { role: RoleRow }) {
  const [state, action, pending] = useActionState(removeRoleChecked, null);
  const [asking, setAsking] = useState(false);
  if (role.is_system) return null;
  return (
    <form action={action} style={{ marginTop: 4 }}>
      <input type="hidden" name="id" value={role.id} />
      {asking ? (
        <span style={{ display: "inline-flex", gap: 4 }}>
          <button className="btn" type="submit" disabled={pending} style={{ fontSize: 11, padding: "3px 8px" }}>Remove</button>
          <button className="btn ghost" type="button" onClick={() => setAsking(false)} style={{ fontSize: 11, padding: "3px 8px" }}>No</button>
        </span>
      ) : (
        <button type="button" className="btn ghost" onClick={() => setAsking(true)} style={{ fontSize: 11, padding: "3px 8px", color: "var(--crit)" }}>
          Remove role
        </button>
      )}
      {state?.error && <div className="sub" style={{ color: "var(--crit)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{state.error}</div>}
    </form>
  );
}

/** Pages (rows) by role (columns), ticked = the role can open that page. Super Admin is
 * always every page; Access itself is Super Admin only. */
export default function AccessMatrix({ roles }: { roles: RoleRow[] }) {
  const initial = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, new Set(r.pages)])), [roles]);
  const [ticks, setTicks] = useState<Record<string, Set<string>>>(initial);
  useEffect(() => setTicks(initial), [initial]);
  // View only: the role opens its pages but can't change anything (e.g. an investor).
  const initialRo = useMemo(() => Object.fromEntries(roles.map((r) => [r.id, r.read_only])), [roles]);
  const [ro, setRo] = useState<Record<string, boolean>>(initialRo);
  useEffect(() => setRo(initialRo), [initialRo]);
  const [state, action, pending] = useActionState(saveMatrix, null);
  const [addState, addAction, adding] = useActionState(addRole, null);

  const editable = roles.filter((r) => !r.is_super);
  const changed = editable.filter((r) => {
    // A role just added has no ticks yet until the effect above copies them in.
    const a = initial[r.id], b = ticks[r.id] ?? a;
    return a.size !== b.size || [...a].some((k) => !b.has(k)) || initialRo[r.id] !== (ro[r.id] ?? initialRo[r.id]);
  });

  const toggle = (roleId: string, key: string, on: boolean) =>
    setTicks((t) => {
      const next = new Set(t[roleId] ?? initial[roleId]);
      if (on) next.add(key); else next.delete(key);
      return { ...t, [roleId]: next };
    });
  const setColumn = (roleId: string, on: boolean) =>
    setTicks((t) => ({ ...t, [roleId]: new Set(on ? ASSIGNABLE_PAGES.map((p) => p.key) : []) }));

  return (
    <div className="panel">
      <div className="phead">
        <div className="ptitle">Access matrix</div>
        <div className="sub">Tick the pages each role can open. Super Admin always has every page.</div>
      </div>
      <form action={action}>
        <input
          type="hidden"
          name="changes"
          value={JSON.stringify(changed.map((r) => ({ id: r.id, name: r.name, pages: [...(ticks[r.id] ?? initial[r.id])], read_only: !!(ro[r.id] ?? initialRo[r.id]) })))}
        />
        <div className="tblwrap keep-table">
          <table>
            <thead>
              <tr>
                <th>Page</th>
                {roles.map((r) => (
                  <th key={r.id} className="n" style={{ textAlign: "center", verticalAlign: "top", minWidth: 110 }}>
                    <div style={{ color: "var(--ink)" }}>{r.name}</div>
                    {r.read_only && <div className="sub" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>view only</div>}
                    <div className="sub" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      {r.users} {r.users === 1 ? "login" : "logins"}
                    </div>
                    {!r.is_super && (
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 4 }}>
                        <button type="button" className="btn ghost" onClick={() => setColumn(r.id, true)} style={{ fontSize: 11, padding: "3px 8px" }}>All</button>
                        <button type="button" className="btn ghost" onClick={() => setColumn(r.id, false)} style={{ fontSize: 11, padding: "3px 8px" }}>None</button>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <b style={{ color: "var(--ink)" }}>View only</b>
                  <div className="sub">Opens the ticked pages but can&apos;t add, edit or remove anything</div>
                </td>
                {roles.map((r) => (
                  <td key={r.id} style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      aria-label={`${r.name}: view only`}
                      checked={!r.is_super && !!(ro[r.id] ?? initialRo[r.id])}
                      disabled={r.is_super}
                      onChange={(e) => setRo((x) => ({ ...x, [r.id]: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: r.is_super ? "not-allowed" : "pointer" }}
                    />
                  </td>
                ))}
              </tr>
              {GROUPS.map((g) => (
                <Fragment key={g}>
                  <tr>
                    <td colSpan={roles.length + 1} style={{ background: "var(--tint)" }}><b style={{ color: "var(--ink)" }}>{g}</b></td>
                  </tr>
                  {PAGES.filter((p) => p.group === g).map((p) => (
                    <tr key={p.key}>
                      <td>
                        {p.label}
                        {FEE_PAGES.includes(p.key) && <span className="sub"> · shows fees</span>}
                        {p.key === "access" && <span className="sub"> · Super Admin only</span>}
                      </td>
                      {roles.map((r) => {
                        const fixed = r.is_super || p.key === "access";
                        const on = r.is_super || (p.key !== "access" && (ticks[r.id] ?? initial[r.id])?.has(p.key));
                        return (
                          <td key={r.id} style={{ textAlign: "center" }}>
                            <input
                              type="checkbox"
                              aria-label={`${r.name}: ${p.label}`}
                              checked={!!on}
                              disabled={fixed}
                              onChange={(e) => toggle(r.id, p.key, e.target.checked)}
                              style={{ width: 16, height: 16, cursor: fixed ? "not-allowed" : "pointer" }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "14px 18px" }}>
          <button className="btn" type="submit" disabled={pending || changed.length === 0}>
            {pending ? "Saving…" : changed.length ? `Save changes (${changed.map((r) => r.name).join(", ")})` : "Save changes"}
          </button>
          {changed.length > 0 && (
            <button className="btn ghost" type="button" onClick={() => { setTicks(initial); setRo(initialRo); }}>Undo</button>
          )}
          {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
          {state?.ok && changed.length === 0 && <span className="sub" style={{ color: "var(--ok)" }}>{state.message}</span>}
        </div>
      </form>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: "0 18px 6px" }}>
        {editable.filter((r) => !r.is_system).map((r) => (
          <div key={r.id} className="sub" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {r.name}: <RemoveRole role={r} />
          </div>
        ))}
      </div>
      <div className="sub" style={{ padding: "0 18px 14px" }}>
        A role with any page marked &ldquo;shows fees&rdquo; also sees invoices, payments and rates on a student&apos;s page.
        Without them, the student page shows details, subjects, guardians and marks only. A login can hold several
        roles and picks which one to use from the &ldquo;Viewing as&rdquo; menu at the top of the portal. Changes apply
        the next time the person opens a page.
      </div>

      <form action={addAction} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", padding: "14px 18px 18px", borderTop: "1px solid var(--line)" }}>
        <div className="field">
          <label className="lbl" htmlFor="role-name">New role</label>
          <input id="role-name" name="name" required maxLength={60} placeholder="e.g. Accounts Admin" style={{ ...inputStyle, minWidth: 220 }} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="role-copy">Start with the pages of</label>
          <select id="role-copy" name="copy_from" defaultValue="" style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">No pages</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, paddingBottom: 9 }}>
          <input type="checkbox" name="read_only" value="1" /> View only
        </label>
        <button className="btn ghost" type="submit" disabled={adding}>{adding ? "Adding…" : "+ Add role"}</button>
        {addState?.error && <span className="sub" style={{ color: "var(--crit)" }}>{addState.error}</span>}
        {addState?.ok && <span className="sub" style={{ color: "var(--ok)" }}>{addState.message}</span>}
      </form>
    </div>
  );
}
