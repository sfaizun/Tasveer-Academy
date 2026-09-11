import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** The signed-in student's own student id(s) — a guardian can have more than one ward.
 * Wraps the existing `my_student_ids()` RPC (already used by RLS) rather than
 * re-deriving the student/guardian join in JS. Returns [] for admin/teacher/anyone
 * with no student link. */
export async function myStudentIds(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase.rpc("my_student_ids");
  return ((data ?? []) as any[])
    .map((v) => (typeof v === "string" ? v : v?.my_student_ids ?? v?.id ?? null))
    .filter((v): v is string => !!v);
}

/**
 * Best-effort "seen" tracking for the announcement reach report: records that the
 * signed-in student/guardian has had each of these announcements on screen, by
 * inserting an `announcement_receipt` row (read_at = now) the first time — never
 * touches an existing row (ignoreDuplicates), so the recorded read_at is always the
 * first view, not the latest. Also returns which of these announcements the viewer
 * has already acknowledged, so the UI can hide the "Acknowledge" action for those.
 */
export async function markSeenAndGetAcks(
  supabase: Supabase,
  announcementIds: string[]
): Promise<Set<string>> {
  if (announcementIds.length === 0) return new Set();
  const studentIds = await myStudentIds(supabase);
  if (studentIds.length === 0) return new Set();

  const rows = studentIds.flatMap((student_id) =>
    announcementIds.map((announcement_id) => ({ announcement_id, student_id, read_at: new Date().toISOString() }))
  );
  // Best-effort — a student/guardian account can write its own receipts under RLS, but
  // this should never block rendering the announcements themselves if it fails.
  try {
    await supabase.from("announcement_receipt").upsert(rows, { onConflict: "announcement_id,student_id", ignoreDuplicates: true });
  } catch {
    // ignore — reach tracking is a bonus, not a requirement for the page to work
  }

  const { data: receipts } = await supabase
    .from("announcement_receipt")
    .select("announcement_id, acknowledged_at")
    .in("announcement_id", announcementIds)
    .in("student_id", studentIds)
    .not("acknowledged_at", "is", null);

  return new Set(((receipts ?? []) as any[]).map((r) => r.announcement_id));
}
