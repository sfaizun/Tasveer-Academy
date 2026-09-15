import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import ChangePasswordForm from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const { user, me } = await getViewer();

  return (
    <>
      <header className="top">
        <h1>Account</h1>
        <div className="sub">
          {me?.full_name}
          {user?.email ? ` · ${user.email}` : ""}
        </div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead">
            <div className="ptitle">Change password</div>
            <div className="sub">You&apos;ll need your current password to confirm the change.</div>
          </div>
          <div style={{ padding: 18 }}>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </>
  );
}
