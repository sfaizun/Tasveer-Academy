import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import AddSubjectForm from "./AddSubjectForm";
import TeachersPanel from "./TeachersPanel";
import { setSubjectActive } from "./actions";

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
        <p className="sub" style={{ margin: "-8px 0 0" }}>
          Fields marked <span style={{ color: "var(--coral)" }}>*</span> are required.
        </p>

        <TeachersPanel
          teachers={(teachers ?? []) as any[]}
          subjects={subjectsList}
          mappings={(mappings ?? []) as any[]}
        />

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
