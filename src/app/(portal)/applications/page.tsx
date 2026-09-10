import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import ApplicationsTable, { type ApplicationRow } from "./ApplicationsTable";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("application")
    .select("id, ref_no, status, payload, submitted_at, review_note, reviewed_at, created_at")
    .order("submitted_at", { ascending: false, nullsFirst: false });

  const applications = (data ?? []) as unknown as ApplicationRow[];

  return (
    <>
      <header className="top">
        <h1>Applications</h1>
        <div className="sub">Submitted through the public admission form at /apply</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ApplicationsTable applications={applications} />
      </div>
    </>
  );
}
