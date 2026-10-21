import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";
import { requirePage } from "@/lib/require-page";
import { actsAsAdmin, viewReadOnly } from "@/lib/access";
import MaterialForm, { type BatchOpt, type MaterialRow } from "./MaterialForm";
import MaterialsTable from "./MaterialsTable";

export const dynamic = "force-dynamic";

const isId = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/.test(s);
const COLS =
  "id, class_group_id, title, material_date, note, created_at, class_group(batch_name), subject(name, level, programme(code)), teacher(full_name), course_material_file(id, name, size, created_at)";

type Group = { id: string; batch_name: string; subject: any; teacher: { full_name: string } | null };
const batchLabel = (subject: any, batch: string | null | undefined) => `${subjectLabel(subject)} · Batch ${batch ?? "-"}`;

/** Course materials: a teacher shares files with a batch of their subject; the batch's students
 * (and guardians) read and download them; admins with Course materials see and manage all. */
export default async function CourseMaterialsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  await requirePage("course_materials");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  const supabase = await createClient();
  const today = dhakaTodayISO();
  const sp = await searchParams;

  const isAdmin = actsAsAdmin(me, "course_materials");
  const isTeacher = !isAdmin && me.role === "teacher";
  const canManage = (isAdmin && !viewReadOnly(me)) || isTeacher;

  // The batches this view works with: a teacher's own, or every batch for an admin.
  let groups: Group[] = [];
  if (isTeacher) {
    const { data: t } = await supabase.from("teacher").select("id").eq("app_user_id", me.id).maybeSingle();
    if (t) {
      const { data } = await supabase.from("class_group").select("id, batch_name, subject(name, level, programme(code)), teacher(full_name)").eq("teacher_id", t.id).eq("active", true);
      groups = (data ?? []) as any[];
    }
  } else if (isAdmin) {
    const { data } = await supabase.from("class_group").select("id, batch_name, subject(name, level, programme(code)), teacher(full_name)").eq("active", true);
    groups = (data ?? []) as any[];
  }
  const batches: BatchOpt[] = groups
    .map((g) => ({ id: g.id, label: batchLabel(g.subject, g.batch_name) + (isAdmin && g.teacher ? ` (${g.teacher.full_name})` : "") }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const batch = isId(sp.batch) && (!isTeacher || groups.some((g) => g.id === sp.batch)) ? sp.batch : "";
  let q = supabase.from("course_material").select(COLS).order("material_date", { ascending: false }).order("created_at", { ascending: false }).limit(300);
  if (batch) q = q.eq("class_group_id", batch);
  // A teacher's own view lists only their own batches, even if an access role could see more.
  else if (isTeacher) q = q.in("class_group_id", groups.length ? groups.map((g) => g.id) : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;

  const rows: MaterialRow[] = ((data ?? []) as any[]).map((m) => ({
    id: m.id, class_group_id: m.class_group_id, title: m.title, material_date: m.material_date, note: m.note,
    batch_label: batchLabel(m.subject, m.class_group?.batch_name), teacher_name: m.teacher?.full_name ?? null,
    files: ((m.course_material_file ?? []) as any[]).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((f) => ({ id: f.id, name: f.name, size: f.size })),
  }));

  // Students and guardians filter by the batches that have materials.
  const filterBatches: BatchOpt[] = canManage || isAdmin
    ? batches
    : [...new Map(rows.map((r) => [r.class_group_id, { id: r.class_group_id, label: r.batch_label }])).values()].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <header className="top">
        <h1>Course materials</h1>
        <div className="sub">{canManage ? "Share notes, slides and worksheets with a batch" : "Notes and files shared by your teachers"}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {canManage && (
          <details className="panel collapsible no-print" open>
            <summary className="phead">
              <div className="ptitle">Share a material</div>
              <div className="sub">Only the students of the batch you choose (and their guardians) will see it</div>
            </summary>
            <div style={{ padding: 18 }}>
              {batches.length ? <MaterialForm batches={batches} today={today} /> : <div className="sub">You have no batches yet. The academy adds you to a batch on Subjects &amp; teachers.</div>}
            </div>
          </details>
        )}

        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ptitle">Materials</div>
            <div className="sub">{rows.length} {rows.length === 1 ? "item" : "items"}</div>
            <div className="spacer" />
            {filterBatches.length > 1 && (
              <form method="get" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select name="batch" defaultValue={batch} aria-label="Subject and batch"
                  style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, background: "var(--paper)", color: "var(--ink)", maxWidth: "100%" }}>
                  <option value="">All subjects and batches</option>
                  {filterBatches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "7px 12px" }}>Show</button>
              </form>
            )}
          </div>
          <MaterialsTable rows={rows} canManage={canManage} showTeacher={!isTeacher} batches={batches} today={today} />
        </div>
      </div>
    </>
  );
}
