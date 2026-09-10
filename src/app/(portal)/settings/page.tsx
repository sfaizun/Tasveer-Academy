import { createClient } from "@/lib/supabase/server";
import { taka } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const supabase = await createClient();

  const [{ data: rates }, { data: settings }] = await Promise.all([
    supabase
      .from("fee_rate")
      .select("id, kind, level, amount, effective_from, note, programme(name, code), class_level(name, sort_order)")
      .order("effective_from", { ascending: false }),
    supabase.from("app_setting").select("key, value, description").order("key"),
  ]);

  const tuition = ((rates ?? []) as any[]).filter((r) => r.kind === "tuition" && !r.class_level);
  const junior = ((rates ?? []) as any[])
    .filter((r) => r.class_level)
    .sort((a, b) => a.class_level.sort_order - b.class_level.sort_order);
  const admission = ((rates ?? []) as any[]).filter((r) => r.kind === "admission");

  return (
    <>
      <header className="top">
        <h1>Fees &amp; settings</h1>
        <div className="sub">Owner only. Rates are never edited in place: a change is a new row.</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead"><div className="ptitle">Tuition and admission</div></div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>Fee</th><th>Basis</th><th className="n">Amount</th><th>Effective from</th></tr>
              </thead>
              <tbody>
                {admission.map((r) => (
                  <tr key={r.id}>
                    <td><b>Admission fee</b></td>
                    <td>Per student, one time</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{r.effective_from}</td>
                  </tr>
                ))}
                {tuition.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.programme?.name}{r.level ? ` (${r.level.toUpperCase()})` : ""}</b></td>
                    <td>Per subject, per month</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{r.effective_from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Junior monthly rates</div>
            <div className="sub">Flat per student, by class level</div>
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Class</th><th className="n">Monthly fee</th><th>Status</th></tr></thead>
              <tbody>
                {junior.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.class_level.name}</b></td>
                    <td className="n mono">{Number(r.amount) > 0 ? taka(r.amount) : <span className="sub">not set</span>}</td>
                    <td>
                      {Number(r.amount) > 0
                        ? <span className="st paid"><span className="dot" />Set</span>
                        : <span className="st past"><span className="dot" />Awaiting amount</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="phead"><div className="ptitle">Operating settings</div></div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>Setting</th><th>Value</th><th>What it controls</th></tr></thead>
              <tbody>
                {(settings ?? []).map((s: any) => (
                  <tr key={s.key}>
                    <td className="mono" style={{ color: "var(--blue)" }}>{s.key}</td>
                    <td className="mono"><b>{String(s.value).replace(/^"|"$/g, "")}</b></td>
                    <td className="sub">{s.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
