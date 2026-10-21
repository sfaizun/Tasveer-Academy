import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import HomeworkForm, { type EnrolOpt } from "./HomeworkForm";
import HomeworkList, { type HomeworkRow } from "./HomeworkList";

export const dynamic = "force-dynamic";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const NONE = "00000000-0000-0000-0000-000000000000";
const COLS =
  "id, homework_date, title, note, status, teacher_comment, created_at, class_group_id, student(full_name, reg_no), class_group(batch_name), subject(name, level, programme(code)), teacher(full_name), homework_file(id, name, size, created_at)";
const batchLabel = (subject: any, batch: string | null | undefined) => `${subjectLabel(subject)} · Batch ${batch ?? "-"}`;

/** Homework: a student uploads homework for a subject teacher (batch from their enrolment); the
 * teacher marks it reviewed with a comment. Guardians see their child's; admins with Homework see all. */
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ status?: string; batch?: string }> }) {
  await requirePage("homework");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const sp = await searchParams;

  const isAdmin = actsAsAdmin(me, "homework");
  const isTeacher = !isAdmin && me.role === "teacher";
  const isStudent = !isAdmin && me.role === "student";
  const canReview = isTeacher || (isAdmin && !viewReadOnly(me));

  // A student's current subjects: teacher, subject and batch for the upload form.
  let studentId: string | null = null;
  let options: EnrolOpt[] = [];
  if (isStudent) {
    const { data: s } = await supabase.from("student").select("id").eq("app_user_id", me.id).maybeSingle();
    studentId = s?.id ?? null;
    if (studentId) {
      const month = today.slice(0, 7) + "-01";
      const { data } = await supabase.from("enrolment")
        .select("id, to_month, subject(name, level, programme(code)), teacher:teacher_id(id, full_name), class_group(batch_name, teacher(id, full_name))")
        .eq("student_id", studentId).eq("status", "active").not("class_group_id", "is", null);
      options = ((data ?? []) as any[])
        .filter((e) => !e.to_month || e.to_month >= month)
        .map((e) => {
          const t = e.class_group?.teacher ?? e.teacher;
          return t ? { enrolment_id: e.id, teacher_id: t.id, teacher_name: t.full_name, subject_label: subjectLabel(e.subject), batch_label: `Batch ${e.class_group?.batch_name ?? "-"}` } : null;
        })
        .filter((o): o is EnrolOpt => !!o)
        .sort((a, b) => a.subject_label.localeCompare(b.subject_label));
    }
  }

  // Batches for the teacher / admin filter.
  let groups: { id: string; label: string }[] = [];
  let myGroupIds: string[] = [];
  let myTeacherId: string | null = null;
  if (isTeacher || isAdmin) {
    let gq = supabase.from("class_group").select("id, batch_name, subject(name, level, programme(code)), teacher(full_name)").eq("active", true);
    if (isTeacher) {
      const { data: t } = await supabase.from("teacher").select("id").eq("app_user_id", me.id).maybeSingle();
      myTeacherId = t?.id ?? null;
      gq = gq.eq("teacher_id", myTeacherId ?? NONE);
    }
    const { data } = await gq;
    groups = ((data ?? []) as any[])
      .map((g) => ({ id: g.id, label: batchLabel(g.subject, g.batch_name) + (isAdmin && g.teacher ? ` (${g.teacher.full_name})` : "") }))
      .sort((a, b) => a.label.localeCompare(b.label));
    myGroupIds = groups.map((g) => g.id);
  }

  const status = sp.status === "submitted" || sp.status === "reviewed" ? sp.status : "";
  const batch = isId(sp.batch) && groups.some((g) => g.id === sp.batch) ? sp.batch : "";
  let q = supabase.from("homework").select(COLS).order("homework_date", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  if (batch) q = q.eq("class_group_id", batch);
  // Own views list only their own: a teacher's batches, a student's uploads.
  if (isTeacher) q = q.or(`teacher_id.eq.${myTeacherId ?? NONE},class_group_id.in.(${(myGroupIds.length ? myGroupIds : [NONE]).join(",")})`);
  if (isStudent) q = q.eq("student_id", studentId ?? NONE);
  const { data } = await q;

  const rows: HomeworkRow[] = ((data ?? []) as any[]).map((h) => ({
    id: h.id, homework_date: h.homework_date, title: h.title, note: h.note,
    student_name: h.student?.full_name ?? "Student", reg_no: h.student?.reg_no ?? null,
    subject_batch: batchLabel(h.subject, h.class_group?.batch_name), teacher_name: h.teacher?.full_name ?? null,
    status: h.status, teacher_comment: h.teacher_comment, submitted_at: h.created_at,
    files: ((h.homework_file ?? []) as any[]).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((f) => ({ id: f.id, name: f.name, size: f.size })),
  }));

  const chip = (value: string, label: string) => {
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (batch) params.set("batch", batch);
    const href = `/homework${params.size ? `?${params}` : ""}`;
    return <a key={value || "all"} href={href} className={`fchip${status === value ? " on" : ""}`} aria-current={status === value ? "page" : undefined}>{label}</a>;
  };

  return (
    <>
      <header className="top">
        <h1>Homework</h1>
        <div className="sub">
          {isStudent ? "Upload homework and assignments for your teachers" : isTeacher ? "Homework your students have uploaded" : me.role === "guardian" ? "Homework your child has uploaded" : "Homework uploaded by students"}
        </div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {isStudent && (
          <div className="panel no-print">
            <div className="phead">
              <div className="ptitle">Upload homework</div>
              <div className="sub">Only the teacher you choose (and the academy) can see it</div>
            </div>
            <div style={{ padding: 18 }}>
              {studentId && options.length
                ? <HomeworkForm options={options} studentId={studentId} today={today} />
                : <div className="sub">You have no current subjects with a batch yet. Please contact the academy.</div>}
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ptitle">{isStudent ? "My homework" : "Submissions"}</div>
            <div className="sub">{rows.length} {rows.length === 1 ? "item" : "items"}</div>
            <div className="spacer" />
            <div className="fchips no-print" role="group" aria-label="Status">
              {chip("", "All")}
              {chip("submitted", isStudent || me.role === "guardian" ? "Waiting for review" : "To review")}
              {chip("reviewed", "Reviewed")}
            </div>
            {groups.length > 1 && (
              <form method="get" className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {status && <input type="hidden" name="status" value={status} />}
                <select name="batch" defaultValue={batch} aria-label="Subject and batch"
                  style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", maxWidth: "100%" }}>
                  <option value="">All subjects and batches</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
                <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "7px 12px" }}>Show</button>
              </form>
            )}
          </div>
          <HomeworkList rows={rows} showStudent={!isStudent} showTeacher={!isTeacher} canReview={canReview} canRemoveOwn={isStudent} />
        </div>
      </div>
    </>
  );
}
