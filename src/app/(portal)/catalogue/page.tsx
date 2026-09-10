import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import AddTeacherForm from "./AddTeacherForm";
import AddSubjectForm from "./AddSubjectForm";
import AddMappingForm from "./AddMappingForm";
import { setTeacherActive, setSubjectActive, setMappingActive } from "./actions";

export const dynamic = "force-dynamic";

function subjectLabel(s: { name: string; level: string | null }) {
  return s.level ? `${s.name} (${s.level.toUpperCase()})` : s.name;
}

export default async function Catalogue() {
  const supabase = await createClient();

  const [{ data: teachers }, { data: subjects }, { data: mappings }, { data: programmes }] = await Promise.all([
    supabase.from("teacher").select("id, full_name, phone, email, active").order("full_name"),
    supabase
      .from("subject")
      .select("id, name, level, active, sort_order, programme_id, programme(code, name)")
      .order("sort_order"),
    supabase.from("teacher_subject").select("teacher_id, subject_id, active"),
    supabase.from("programme").select("id, code, name").order("code"),
  ]);

  const subjectsList = (subjects ?? []) as any[];
  const subjectById = new Map(subjectsList.map((s) => [s.id, s]));

  const mappingsByTeacher = new Map<string, { subject_id: string; active: boolean }[]>();
  for (const m of (mappings ?? []) as any[]) {
    const list = mappingsByTeacher.get(m.teacher_id) ?? [];
    list.push({ subject_id: m.subject_id, active: m.active });
    mappingsByTeacher.set(m.teacher_id, list);
  }

  const byProgramme = new Map<string, { code: string; name: string; rows: any[] }>();
  for (const s of subjectsList) {
    const code = s.programme?.code ?? "other";
    if (!byProgramme.has(code)) byProgramme.set(code, { code, name: s.programme?.name ?? "Other", rows: [] });
    byProgramme.get(code)!.rows.push(s);
  }

  return (
    <>
      <header className="top">
        <h1>Subjects &amp; teachers</h1>
        <div className="sub">Admin managed. Retired, never deleted, once enrolled against.</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead">
            <div className="ptitle">Teachers</div>
            <div className="sub">{teachers?.length ?? 0} on staff</div>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Subjects taught</th>
                  <th className="n">Status</th>
                  <th className="n"></th>
                </tr>
              </thead>
              <tbody>
                {((teachers ?? []) as any[]).map((t) => {
                  const mine = mappingsByTeacher.get(t.id) ?? [];
                  const activeMine = mine.filter((m) => m.active);
                  const mappedIds = new Set(mine.filter((m) => m.active).map((m) => m.subject_id));
                  const options = subjectsList
                    .filter((s) => s.active && !mappedIds.has(s.id))
                    .map((s) => ({ id: s.id, label: `${s.programme?.name ?? ""} — ${subjectLabel(s)}` }));

                  return (
                    <tr key={t.id}>
                      <td style={{ verticalAlign: "top" }}>
                        <b>{t.full_name}</b>
                        <div className="sub">{[t.phone, t.email].filter(Boolean).join(" · ") || "—"}</div>
                      </td>
                      <td style={{ verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {activeMine.length === 0 && <span className="sub">not mapped yet</span>}
                          {activeMine.map((m) => {
                            const s = subjectById.get(m.subject_id);
                            if (!s) return null;
                            return (
                              <span key={m.subject_id} className="chip">
                                {s.programme?.name}: {subjectLabel(s)}
                                <form action={setMappingActive} style={{ display: "inline" }}>
                                  <input type="hidden" name="teacher_id" value={t.id} />
                                  <input type="hidden" name="subject_id" value={m.subject_id} />
                                  <input type="hidden" name="active" value="false" />
                                  <button
                                    type="submit"
                                    title="Unmap"
                                    style={{
                                      border: 0, background: "transparent", color: "var(--muted)",
                                      cursor: "pointer", marginLeft: 4, fontSize: 12, padding: 0,
                                    }}
                                  >
                                    ×
                                  </button>
                                </form>
                              </span>
                            );
                          })}
                        </div>
                        <AddMappingForm teacherId={t.id} options={options} />
                      </td>
                      <td className="n">
                        {t.active ? (
                          <span className="st paid"><span className="dot" />Active</span>
                        ) : (
                          <span className="st past"><span className="dot" />Retired</span>
                        )}
                      </td>
                      <td className="n">
                        <form action={setTeacherActive}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="active" value={String(!t.active)} />
                          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                            {t.active ? "Retire" : "Reactivate"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: 16, borderTop: "1px solid var(--line2)" }}>
            <AddTeacherForm />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {(programmes ?? []).map((p: any) => {
            const grp = byProgramme.get(p.code);
            const rows = grp?.rows ?? [];
            return (
              <div className="panel" key={p.id}>
                <div className="phead">
                  <div className="ptitle">{p.name}</div>
                  <div className="sub">{rows.length} subject{rows.length === 1 ? "" : "s"}</div>
                </div>
                <div className="tblwrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th className="n">Status</th>
                        <th className="n"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id}>
                          <td><b>{subjectLabel(s)}</b></td>
                          <td className="n">
                            {s.active ? (
                              <span className="st paid"><span className="dot" />Active</span>
                            ) : (
                              <span className="st past"><span className="dot" />Retired</span>
                            )}
                          </td>
                          <td className="n">
                            <form action={setSubjectActive}>
                              <input type="hidden" name="id" value={s.id} />
                              <input type="hidden" name="active" value={String(!s.active)} />
                              <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                                {s.active ? "Retire" : "Reactivate"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={3} className="sub">No subjects yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: 16, borderTop: "1px solid var(--line2)" }}>
                  <AddSubjectForm programmeId={p.id} needsLevel={p.code === "a_level"} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
