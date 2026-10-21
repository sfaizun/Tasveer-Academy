import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { requirePage } from "@/lib/require-page";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Student ID cards: who has one, who still needs one. Cards are created when an application is
 * approved; students admitted earlier get theirs from here. */
export default async function IdCardsPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  await requirePage("id_cards");
  const sp = await searchParams;
  const show = sp.show === "none" || sp.show === "issued" ? sp.show : "";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const supabase = await createClient();
  const [{ data: students }, { data: cards }] = await Promise.all([
    supabase.from("student").select("id, full_name, reg_no, status, photo_path").in("status", ["active", "on_hold"]).order("full_name"),
    supabase.from("student_id_card").select("student_id, issue_no, issued_at, print_count").eq("status", "active"),
  ]);
  const byStudent = new Map(((cards ?? []) as any[]).map((c) => [c.student_id as string, c]));
  const all = ((students ?? []) as any[]).map((s) => ({ ...s, card: byStudent.get(s.id) ?? null }));
  const missing = all.filter((s) => !s.card).length;
  const rows = all.filter((s) =>
    (show === "none" ? !s.card : show === "issued" ? !!s.card : true) &&
    (!q || `${s.full_name} ${s.reg_no}`.toLowerCase().includes(q)));
  const chip = (value: string, label: string) => (
    <a href={`/id-cards${value ? `?show=${value}` : ""}`} className={`fchip${show === value ? " on" : ""}`} aria-current={show === value ? "page" : undefined}>{label}</a>
  );

  return (
    <>
      <header className="top">
        <h1>Student ID cards</h1>
        <div className="sub">{all.length - missing} issued · {missing} still to create</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="fchips" role="group" aria-label="Show">
              {chip("", `All (${all.length})`)}
              {chip("none", `No card yet (${missing})`)}
              {chip("issued", `Issued (${all.length - missing})`)}
            </div>
            <div className="spacer" />
            <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {show && <input type="hidden" name="show" value={show} />}
              <input name="q" defaultValue={q} placeholder="Name or student ID" aria-label="Search students"
                style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5, background: "var(--paper)", color: "var(--ink)" }} />
              <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "7px 12px" }}>Search</button>
            </form>
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Student</th><th>Student ID</th><th>Photo</th><th>ID card</th><th>Printed</th><th className="n"></th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><a href={`/students/${s.id}`}><b>{s.full_name}</b></a></td>
                    <td className="mono">{s.reg_no}</td>
                    <td>{s.photo_path ? "Yes" : <span className="sub">No photo</span>}</td>
                    <td>{s.card
                      ? <span className="st paid"><span className="dot" />Card {s.card.issue_no} · {fmtDate(s.card.issued_at)}</span>
                      : <span className="st due"><span className="dot" />Not created</span>}</td>
                    <td className="mono">{s.card ? s.card.print_count : "-"}</td>
                    <td className="n"><a className={s.card ? "btn ghost" : "btn"} href={`/students/${s.id}/id-card`} style={{ fontSize: 12, padding: "6px 10px" }}>{s.card ? "Open card" : "Create card"}</a></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="sub">No students match.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
