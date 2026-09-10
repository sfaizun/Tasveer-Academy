import { signOut } from "../login/actions";

export default function NoAccess() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="panel" style={{ padding: 28, maxWidth: 440 }}>
        <h1 style={{ fontSize: 19, marginBottom: 8 }}>This account has no access yet</h1>
        <p style={{ marginTop: 0, color: "var(--body)" }}>
          You signed in successfully, but no role has been assigned to this email. An admin needs
          to add you before the portal will show anything.
        </p>
        <form action={signOut}>
          <button className="btn ghost" type="submit">Sign out</button>
        </form>
      </div>
    </main>
  );
}
