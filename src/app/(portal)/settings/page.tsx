import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import { taka, fmtDate } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AddFeeRateForm from "./AddFeeRateForm";

export const dynamic = "force-dynamic";

function groupKey(r: { kind: string; programme_id: string; level: string | null; class_level_id: string | null }) {
  return `${r.kind}|${r.programme_id}|${r.level ?? ""}|${r.class_level_id ?? ""}`;
}

export default async function Settings() {
  const supabase = await createClient();
  const { me } = await getViewer();

  const [{ data: rates }, { data: settings }, { data: programmes }, { data: classLevels }] =
    await Promise.all([
      supabase
        .from("fee_rate")
        .select(
          "id, kind, level, programme_id, class_level_id, amount, effective_from, note, programme(name, code), class_level(name, sort_order)"
        )
        .order("effective_from", { ascending: false }),
      supabase.from("app_setting").select("key, value, description").order("key"),
      supabase.from("programme").select("id, code, name").order("code"),
      supabase.from("class_level").select("id, code, name, sort_order").order("sort_order"),
    ]);

  const today = new Date().toISOString().slice(0, 10);
  const allRates = (rates ?? []) as any[];

  // Latest row per group whose effective_from has arrived is the "current" rate.
  const currentByGroup = new Map<string, any>();
  for (const r of allRates) {
    if (r.effective_from > today) continue;
    const key = groupKey(r);
    const existing = currentByGroup.get(key);
    if (!existing || r.effective_from > existing.effective_from) currentByGroup.set(key, r);
  }
  const current = Array.from(currentByGroup.values());
  const admission = current.filter((r) => r.kind === "admission");
  const mock = current.filter((r) => r.kind === "mock");
  const tuition = current.filter((r) => r.kind === "tuition" && !r.class_level_id);
  const junior = current
    .filter((r) => r.kind === "tuition" && r.class_level_id)
    .sort((a, b) => a.class_level.sort_order - b.class_level.sort_order);

  const progByCode = new Map((programmes ?? []).map((p: any) => [p.code, p]));
  const oLevel = progByCode.get("o_level");
  const aLevel = progByCode.get("a_level");
  const junior_ = progByCode.get("junior");

  const options: { value: string; label: string }[] = [];
  if (oLevel) {
    options.push({ value: `admission|${oLevel.id}||`, label: "Admission fee — O Level (one time)" });
    options.push({ value: `tuition|${oLevel.id}||`, label: "O Level — per subject/month" });
  }
  if (aLevel) {
    options.push({ value: `admission|${aLevel.id}||`, label: "Admission fee — A Level (one time)" });
    options.push({ value: `tuition|${aLevel.id}|as|`, label: "A Level AS — per subject/month" });
    options.push({ value: `tuition|${aLevel.id}|a2|`, label: "A Level A2 — per subject/month" });
  }
  if (junior_) {
    options.push({ value: `admission|${junior_.id}||`, label: "Admission fee — Junior (one time)" });
    for (const c of classLevels ?? []) {
      options.push({ value: `tuition|${junior_.id}||${c.id}`, label: `Junior — ${c.name} (monthly)` });
    }
  }
  if (oLevel || aLevel) {
    // Global — same flat rate whether the candidate sits O Level or A Level mocks.
    options.push({ value: `mock|||`, label: "Mock exam fee — O/A Level (flat, one time)" });
  }

  const isOwner = !!me?.is_owner;

  return (
    <>
      <header className="top">
        <h1>Fees &amp; settings</h1>
        <div className="sub">Owner only to change. Rates are never edited in place: a change is a new dated row.</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead"><div className="ptitle">Tuition and admission — current</div></div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>Fee</th><th>Basis</th><th className="n">Amount</th><th>Effective from</th></tr>
              </thead>
              <tbody>
                {admission.map((r) => (
                  <tr key={r.id}>
                    <td><b>Admission fee — {r.programme?.name ?? "—"}</b></td>
                    <td>{r.programme?.code === "junior" ? "Per student, one time" : "Per subject, one time"}</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
                {tuition.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.programme?.name}{r.level ? ` (${r.level.toUpperCase()})` : ""}</b></td>
                    <td>Per subject, per month</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
                {mock.map((r) => (
                  <tr key={r.id}>
                    <td><b>Mock exam fee — O/A Level</b></td>
                    <td>Flat per student, one time (same for O and A Level)</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Junior monthly rates — current</div>
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

        {isOwner && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Change a rate</div>
              <div className="sub">Owner only</div>
            </div>
            <div style={{ padding: 18 }}>
              <AddFeeRateForm options={options} />
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Rate history</div>
            <div className="sub">Every rate ever set, newest first</div>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>Fee</th><th className="n">Amount</th><th>Effective from</th><th>Note</th></tr>
              </thead>
              <tbody>
                {allRates.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.kind === "admission"
                        ? `Admission fee — ${r.programme?.name ?? "—"}`
                        : r.kind === "mock"
                        ? "Mock exam fee — O/A Level"
                        : r.class_level
                        ? `Junior — ${r.class_level.name}`
                        : `${r.programme?.name}${r.level ? ` (${r.level.toUpperCase()})` : ""}`}
                    </td>
                    <td className="n mono">{taka(r.amount)}</td>
                    <td className="mono sub">{fmtDate(r.effective_from)}{r.effective_from > today ? " (upcoming)" : ""}</td>
                    <td className="sub">{r.note ?? "—"}</td>
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
