import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import TaskForm, { type BatchOpt } from "./TaskForm";
import TaskList, { type TaskRow } from "./TaskList";
import StudentTasks, { type StudentTask } from "./StudentTasks";
import HomeworkList, { type HomeworkRow } from "./HomeworkList";

export const dynamic = "force-dynamic";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const NONE = "00000000-0000-0000-0000-000000000000";
const SUB_COLS =
  "id, task_id, student_id, homework_date, title, note, status, teacher_comment, created_at, class_group_id, student(full_name, reg_no), class_group(batch_name), subject(name, level, programme(code)), teacher(full_name), homework_file(id, name, size, created_at)";
const TASK_COLS =
  "id, class_group_id, title, instructions, set_on, due_on, created_at, class_group(batch_name, subject(name, level, programme(code)), teacher(full_name)), homework_task_file(id, name, size, created_at)";
const batchLabel = (subject: any, batch: string | null | undefined) => `${subjectLabel(subject)} · Batch ${batch ?? "-"}`;
const byCreated = (a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at));

function toSub(h: any): HomeworkRow {
  return {
    id: h.id, homework_date: h.homework_date, title: h.title, note: h.note,
    student_name: h.student?.full_name ?? "Student", reg_no: h.student?.reg_no ?? null,
    subject_batch: batchLabel(h.subject, h.class_group?.batch_name), teacher_name: h.teacher?.full_name ?? null,
    status: h.status, teacher_comment: h.teacher_comment, submitted_at: h.created_at,
    files: ((h.homework_file ?? []) as any[]).sort(byCreated).map((f) => ({ id: f.id, name: f.name, size: f.size })),
  };
}
const taskFiles = (t: any) => ((t.homework_task_file ?? []) as any[]).sort(byCreated).map((f) => ({ id: f.id, name: f.name, size: f.size }));

/** Homework: the teacher sets homework for a batch (title, due date, optional files); the batch's
 * students submit against it; the teacher sees who has and hasn't submitted, and reviews each with a
 * comment. Late submissions are allowed and marked Late. Guardians see their child's; admins with
 * Homework see all. Older uploads made before homework was set this way are listed separately. */
export default async function HomeworkPage({ searchParams }: { searchParams: Promise<{ show?: string; batch?: string }> }) {
  await requirePage("homework");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const sp = await searchParams;

  const isAdmin = actsAsAdmin(me, "homework");
  const isTeacher = !isAdmin && me.role === "teacher";
  const isStudent = !isAdmin && me.role === "student";
  const isFamily = !isAdmin && (me.role === "student" || me.role === "guardian");
  const canEdit = isTeacher || (isAdmin && !viewReadOnly(me));

  // ---------- Students and guardians ----------
  if (isFamily) {
    let studentId: string | null = null;
    if (isStudent) {
      const { data: s } = await supabase.from("student").select("id").eq("app_user_id", me.id).maybeSingle();
      studentId = s?.id ?? null;
    }
    const [{ data: taskData }, { data: subData }] = await Promise.all([
      supabase.from("homework_task").select(TASK_COLS).order("due_on", { ascending: false }).limit(200),
      supabase.from("homework").select(SUB_COLS).order("homework_date", { ascending: false }).limit(400),
    ]);
    const subs = (subData ?? []) as any[];
    const byTask = new Map(subs.filter((h) => h.task_id && (!studentId || h.student_id === studentId)).map((h) => [h.task_id, h]));
    const all: StudentTask[] = ((taskData ?? []) as any[]).map((t) => {
      const h = byTask.get(t.id);
      return {
        id: t.id, batch_label: batchLabel(t.class_group?.subject, t.class_group?.batch_name), teacher_name: t.class_group?.teacher?.full_name ?? null,
        title: t.title, instructions: t.instructions, set_on: t.set_on, due_on: t.due_on, files: taskFiles(t),
        sub: h ? toSub(h) : null, late: !!h && h.homework_date > t.due_on,
      };
    });
    const show = sp.show === "todo" || sp.show === "done" ? sp.show : "";
    const tasks = all
      .filter((t) => (show === "todo" ? !t.sub : show === "done" ? !!t.sub : true))
      // Not submitted first (soonest due first), then the rest newest first.
      .sort((a, b) => Number(!!a.sub) - Number(!!b.sub) || (a.sub ? b.due_on.localeCompare(a.due_on) : a.due_on.localeCompare(b.due_on)));
    const todo = all.filter((t) => !t.sub).length;
    const earlier = subs.filter((h) => !h.task_id).map(toSub);
    const chip = (value: string, label: string) => (
      <a key={value || "all"} href={value ? `/homework?show=${value}` : "/homework"} className={`fchip${show === value ? " on" : ""}`} aria-current={show === value ? "page" : undefined}>{label}</a>
    );

    return (
      <>
        <header className="top">
          <h1>Homework</h1>
          <div className="sub">{isStudent ? "Homework set by your teachers" : "Homework set for your child"}</div>
          <div className="spacer" />
          <ThemeToggle />
        </header>
        <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel">
            <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
              <div className="ptitle">Homework</div>
              <div className="sub">{todo ? `${todo} to submit` : "All submitted"}</div>
              <div className="spacer" />
              <div className="fchips no-print" role="group" aria-label="Show">
                {chip("", "All")}
                {chip("todo", "To submit")}
                {chip("done", "Submitted")}
              </div>
            </div>
            <StudentTasks tasks={tasks} studentId={studentId} today={today} canSubmit={isStudent} />
          </div>
          {earlier.length > 0 && (
            <details className="panel collapsible">
              <summary className="phead">
                <div className="ptitle">Earlier uploads</div>
                <div className="sub">Uploaded before teachers set homework on the portal</div>
              </summary>
              <HomeworkList rows={earlier} showStudent={!isStudent} showTeacher canReview={false} canRemoveOwn={isStudent} />
            </details>
          )}
        </div>
      </>
    );
  }

  // ---------- Teachers and admins ----------
  let gq = supabase.from("class_group").select("id, batch_name, subject(name, level, programme(code)), teacher(full_name)").eq("active", true);
  if (isTeacher) {
    const { data: t } = await supabase.from("teacher").select("id").eq("app_user_id", me.id).maybeSingle();
    gq = gq.eq("teacher_id", t?.id ?? NONE);
  }
  const { data: groupData } = await gq;
  const batches: BatchOpt[] = ((groupData ?? []) as any[])
    .map((g) => ({ id: g.id, label: batchLabel(g.subject, g.batch_name) + (isAdmin && g.teacher ? ` (${g.teacher.full_name})` : "") }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const groupIds = batches.map((b) => b.id);

  const batch = isId(sp.batch) && groupIds.includes(sp.batch) ? sp.batch : "";
  let tq = supabase.from("homework_task").select(TASK_COLS).order("due_on", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (batch) tq = tq.eq("class_group_id", batch);
  else if (isTeacher) tq = tq.in("class_group_id", groupIds.length ? groupIds : [NONE]);
  const { data: taskData } = await tq;
  const taskRows = (taskData ?? []) as any[];
  const taskIds = taskRows.map((t) => t.id);
  const taskGroups = [...new Set(taskRows.map((t) => t.class_group_id))];

  let eq = supabase.from("homework").select(SUB_COLS).is("task_id", null).order("homework_date", { ascending: false }).limit(200);
  if (batch) eq = eq.eq("class_group_id", batch);
  else if (isTeacher) eq = eq.in("class_group_id", groupIds.length ? groupIds : [NONE]);
  const [{ data: subData }, { data: rosterData }, { data: earlierData }] = await Promise.all([
    taskIds.length ? supabase.from("homework").select(SUB_COLS).in("task_id", taskIds) : Promise.resolve({ data: [] as any[] }),
    taskGroups.length ? supabase.rpc("fn_hw_roster", { p_groups: taskGroups }) : Promise.resolve({ data: [] as any[] }),
    eq,
  ]);
  const subs = (subData ?? []) as any[];
  const roster = (rosterData ?? []) as { class_group_id: string; student_id: string; full_name: string; reg_no: string | null }[];

  const tasks: TaskRow[] = taskRows.map((t) => {
    const mine = subs.filter((h) => h.task_id === t.id);
    const entries = new Map<string, TaskRow["roster"][number]>();
    for (const r of roster.filter((x) => x.class_group_id === t.class_group_id)) {
      entries.set(r.student_id, { student_id: r.student_id, name: r.full_name, reg_no: r.reg_no, sub: null, late: false });
    }
    // Submissions from students who have since left the batch still show.
    for (const h of mine) {
      const e = entries.get(h.student_id) ?? { student_id: h.student_id, name: h.student?.full_name ?? "Student", reg_no: h.student?.reg_no ?? null, sub: null, late: false };
      entries.set(h.student_id, { ...e, sub: toSub(h), late: h.homework_date > t.due_on });
    }
    const list = [...entries.values()];
    return {
      id: t.id, class_group_id: t.class_group_id, batch_label: batchLabel(t.class_group?.subject, t.class_group?.batch_name),
      teacher_name: t.class_group?.teacher?.full_name ?? null, title: t.title, instructions: t.instructions,
      set_on: t.set_on, due_on: t.due_on, files: taskFiles(t), roster: list,
      submitted: list.filter((x) => x.sub).length, late: list.filter((x) => x.late).length,
    };
  });
  const earlier = ((earlierData ?? []) as any[]).map(toSub);

  return (
    <>
      <header className="top">
        <h1>Homework</h1>
        <div className="sub">{isTeacher ? "Set homework for your batches and see who has submitted" : "Homework set by teachers, and students' submissions"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {canEdit && (
          <details className="panel collapsible no-print" open={isTeacher}>
            <summary className="phead">
              <div className="ptitle">Set homework</div>
              <div className="sub">The students of the batch see it on their Homework page and submit there</div>
            </summary>
            <div style={{ padding: 18 }}>
              {batches.length ? <TaskForm batches={batches} today={today} /> : <div className="sub">You have no batches yet. The academy adds you to a batch on Subjects &amp; teachers.</div>}
            </div>
          </details>
        )}

        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ptitle">Homework set</div>
            <div className="sub">{tasks.length} {tasks.length === 1 ? "item" : "items"}</div>
            <div className="spacer" />
            {batches.length > 1 && (
              <form method="get" className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select name="batch" defaultValue={batch} aria-label="Subject and batch"
                  style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", maxWidth: "100%" }}>
                  <option value="">All subjects and batches</option>
                  {batches.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
                <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "7px 12px" }}>Show</button>
              </form>
            )}
          </div>
          <TaskList tasks={tasks} batches={batches} today={today} canManage={canEdit} canReview={canEdit} showTeacher={!isTeacher} />
        </div>

        {earlier.length > 0 && (
          <details className="panel collapsible">
            <summary className="phead">
              <div className="ptitle">Earlier uploads</div>
              <div className="sub">Uploaded by students before homework was set on the portal</div>
            </summary>
            <HomeworkList rows={earlier} showStudent showTeacher={!isTeacher} canReview={canEdit} canRemoveOwn={false} />
          </details>
        )}
      </div>
    </>
  );
}
