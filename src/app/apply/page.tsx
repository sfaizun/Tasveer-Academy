import { createClient } from "@/lib/supabase/server";
import ApplyForm, { type CatalogueData } from "./ApplyForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const supabase = await createClient();

  // Every table this form would otherwise read (programme, class_level, subject,
  // teacher, teacher_subject, fee_rate) is RLS-locked to authenticated admin/owner
  // reads only — an anonymous applicant gets zero rows from a direct select. This
  // single security-definer function is the public, read-only entry point instead.
  const { data, error } = await supabase.rpc("fn_public_admission_catalogue");

  const catalogueRaw = (!error && data) || {
    programmes: [],
    class_levels: [],
    subjects: [],
    teacher_subjects: [],
    fee_rates: [],
  };

  const progById = new Map((catalogueRaw.programmes ?? []).map((p: any) => [p.id, p]));

  const admissionFeeRow = (catalogueRaw.fee_rates ?? []).find((r: any) => r.kind === "admission");
  const admissionFee = admissionFeeRow ? Number(admissionFeeRow.amount) : 0;

  // Flat mock exam fee, same for O Level and A Level (decision, 14 Sep 2026).
  const mockFeeRow = (catalogueRaw.fee_rates ?? []).find((r: any) => r.kind === "mock");
  const mockFee = mockFeeRow ? Number(mockFeeRow.amount) : 5000;

  const juniorFeeByClassLevel = new Map<string, number>();
  const subjectFeeByProgLevel = new Map<string, number>();
  for (const r of (catalogueRaw.fee_rates ?? []) as any[]) {
    if (r.kind !== "tuition") continue;
    if (r.class_level_id) juniorFeeByClassLevel.set(r.class_level_id, Number(r.amount));
    else subjectFeeByProgLevel.set(`${r.programme_id}:${r.level ?? ""}`, Number(r.amount));
  }

  const teachersBySubject = new Map<string, { id: string; name: string }[]>();
  for (const row of (catalogueRaw.teacher_subjects ?? []) as any[]) {
    const list = teachersBySubject.get(row.subject_id) ?? [];
    list.push({ id: row.teacher_id, name: row.teacher_name });
    teachersBySubject.set(row.subject_id, list);
  }

  const catalogue: CatalogueData = {
    admissionFee,
    mockFee,
    classLevels: (catalogueRaw.class_levels ?? []).map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      monthlyFee: juniorFeeByClassLevel.get(c.id) ?? 0,
    })),
    subjects: (catalogueRaw.subjects ?? []).map((s: any) => {
      const prog: any = progById.get(s.programme_id);
      return {
        id: s.id,
        name: s.name,
        level: s.level as "as" | "a2" | null,
        programmeCode: prog?.code ?? "",
        monthlyFee: subjectFeeByProgLevel.get(`${s.programme_id}:${s.level ?? ""}`) ?? 0,
        teachers: (teachersBySubject.get(s.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
      };
    }),
  };

  return <ApplyForm catalogue={catalogue} />;
}
