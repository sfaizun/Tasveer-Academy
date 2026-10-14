import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { type DupMatch, findDuplicates, toCandidates } from "@/lib/duplicates";
import ApplicationsTable, { type ApplicationRow } from "./ApplicationsTable";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const supabase = await createClient();

  const [{ data }, { data: studentData }] = await Promise.all([
    supabase
      .from("application")
      .select("id, ref_no, status, payload, submitted_at, review_note, reviewed_at, created_at")
      .order("submitted_at", { ascending: false, nullsFirst: false }),
    supabase.from("student").select("id, reg_no, full_name, phone, email, status, application_id"),
  ]);

  const applications = (data ?? []) as unknown as ApplicationRow[];

  // Possible duplicates for every application not yet approved or rejected: an existing
  // student or another open application with the same name, phone or email.
  const candidates = toCandidates((studentData ?? []) as any[], applications);
  const duplicates: Record<string, DupMatch[]> = {};
  for (const a of applications) {
    if (a.status === "approved" || a.status === "rejected") continue;
    const m = findDuplicates(a, candidates);
    if (m.length) duplicates[a.id] = m;
  }

  return (
    <>
      <header className="top">
        <h1>Applications</h1>
        <div className="sub">Submitted through the public admission form at /apply</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <ApplicationsTable applications={applications} duplicates={duplicates} />
      </div>
    </>
  );
}
