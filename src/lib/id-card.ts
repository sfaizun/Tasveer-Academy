import { createClient } from "@/lib/supabase/server";
import type { IdCardData } from "@/components/IdCard";
import { subjectLabel } from "@/lib/mock";

type Supabase = Awaited<ReturnType<typeof createClient>>;
export type CardRow = { id: string; issue_no: number; status: string; issued_at: string; print_count: number; last_printed_at: string | null; issued_by_user: { full_name: string } | null };

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Everything printed on a student's ID card, read fresh each time so the card always shows the
 * student's and primary guardian's current details. Null if the student isn't readable. */
export async function loadIdCard(supabase: Supabase, studentId: string): Promise<{ data: IdCardData; card: CardRow | null } | null> {
  const [{ data: s }, { data: guardians }, { data: enrols }, { data: settings }, { data: card }] = await Promise.all([
    supabase.from("student").select("id, full_name, reg_no, phone, address, school_name, admitted_on, programme(name), class_level(name)").eq("id", studentId).maybeSingle(),
    supabase.from("guardian").select("full_name, relation, phone, is_primary, created_at").eq("student_id", studentId).order("is_primary", { ascending: false }).order("created_at"),
    supabase.from("enrolment").select("status, to_month, subject(name, level, sort_order, programme(code))").eq("student_id", studentId).eq("status", "active"),
    supabase.from("app_setting").select("key, value").in("key", ["academy_name", "academy_address", "academy_phone", "portal_url", "facebook_url", "instagram_url"]),
    supabase.from("student_id_card").select("id, issue_no, status, issued_at, print_count, last_printed_at, issued_by_user:issued_by(full_name)").eq("student_id", studentId).eq("status", "active").maybeSingle(),
  ]);
  if (!s) return null;
  const st = s as any;
  const set = new Map(((settings ?? []) as any[]).map((r) => [r.key, str(r.value)]));
  const month = new Date().toISOString().slice(0, 7) + "-01";
  const subjects = ((enrols ?? []) as any[])
    .filter((e) => e.subject && (!e.to_month || e.to_month >= month))
    .sort((a, b) => (a.subject.sort_order ?? 0) - (b.subject.sort_order ?? 0))
    .map((e) => subjectLabel(e.subject));
  const g = ((guardians ?? []) as any[])[0];
  return {
    card: (card as CardRow | null) ?? null,
    data: {
      academy: { name: set.get("academy_name") || "Tasveer Academy", address: set.get("academy_address") || "", phone: set.get("academy_phone") || "" },
      links: { portal: set.get("portal_url") || "", facebook: set.get("facebook_url") || "", instagram: set.get("instagram_url") || "" },
      student: {
        name: st.full_name, regNo: st.reg_no, programme: st.class_level?.name ?? st.programme?.name ?? "",
        subjects: [...new Set(subjects)].join(", "), admittedOn: st.admitted_on ?? null,
        phone: st.phone ?? null, school: st.school_name ?? null, address: st.address ?? null,
      },
      guardian: g ? { name: g.full_name, relation: g.relation ?? null, phone: g.phone ?? null } : null,
      issueNo: (card as any)?.issue_no ?? 1,
    },
  };
}
