import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

type TeacherRow = {
  id: string;
  full_name: string;
  active: boolean;
  teacher_subject: { subject: { name: string; level: string | null } | null }[];
};

export default async function Catalogue() {
  const supabase = await createClient();

  const [{ data: teachers }, { data: subjects }] = await Promise.all([
    supabase
      .from("teacher")
      .select("id, full_name, active, teacher_subject(subject(name, level))")
      .order("full_name"),
    supabase
      .from("subject")
      .select("id, name, level, active, sort_order, programme(code, name)")
      .order("sort_order"),
  ]);

  const byProgramme = new Map<string, { name: string; rows: string[] }>();
  for (const s of (subjects ?? []) as any[]) {
    const code = s.programme?.code ?? "other";
    if (!byProgramme.has(code)) byProgramme.set(code, { name: s.programme?.name ?? "Other", rows: [] });
    const label = s.level ? `${s.name} (${s.level.toUpperCase()})` : s.name;
    byProgramme.get(code)!.rows.push(label);
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
                <tr><th>Teacher</th><th>Subjects taught</th><th className="n">Mapped</th></tr>
              </thead>
              <tbody>
                {((teachers ?? []) as unknown as TeacherRow[]).map((t) => {
                  const names = Array.from(
                    new Set(t.teacher_subject.map((ts) => ts.subject?.name).filter(Boolean) as string[])
                  ).sort();
                  return (
                    <tr key={t.id}>
                      <td><b>{t.full_name}</b></td>
                      <td>{names.length ? names.join(", ") : <span className="sub">not mapped yet</span>}</td>
                      <td className="n mono">{t.teacher_subject.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line2)" }} className="sub">
            One teacher can hold several subjects, and one subject can have several teachers. The
            mapped count includes each AS and A2 row separately.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          {Array.from(byProgramme.entries()).map(([code, p]) => (
            <div className="panel" key={code}>
              <div className="phead">
                <div className="ptitle">{p.name}</div>
                <div className="sub">{p.rows.length} entries</div>
              </div>
              <ul style={{ margin: 0, padding: "12px 16px 14px 30px", fontSize: 13.5 }}>
                {p.rows.map((r, i) => <li key={i} style={{ marginBottom: 3 }}>{r}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
