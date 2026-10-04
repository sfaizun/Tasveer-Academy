import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import { taka, fmtDate } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";
import AddFeeRateForm from "./AddFeeRateForm";

export const dynamic = "force-dynamic";

function groupKey(r: { kind: string; programme_id: string; level: string | null; class_level_id: string | null; subject_id: string | null }) {
  return `${r.kind}|${r.programme_id}|${r.level ?? ""}|${r.class_level_id ?? ""}|${r.subject_id ?? ""}`;
}

const LEVEL_NAME: Record<string, string> = { as: "AS", a2: "A2" };

export default async function Settings() {
  const supabase = await createClient();
  const { me } = await getViewer();

  const [{ data: rates }, { data: settings }, { data: programmes }, { data: classLevels }, { data: aSubjects }] =
    await Promise.all([
      supabase
        .from("fee_rate")
        .select(
          "id, kind, level, programme_id, class_level_id, subject_id, amount, effective_from, note, programme(name, code), class_level(name, sort_order), subject(name, level)"
        )
        .order("effective_from", { ascending: false }),
      supabase.from("app_setting").select("key, value, description").order("key"),
      supabase.from("programme").select("id, code, name").order("code"),
      supabase.from("class_level").select("id, code, name, sort_order").order("sort_order"),
      supabase.from("subject").select("id, name, level, active, sort_order").not("level", "is", null).order("sort_order"),
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
  const tuition = current.filter((r) => r.kind === "tuition" && !r.class_level_id && !r.subject_id);
  const ownPrice = new Map(current.filter((r) => r.kind === "tuition" && r.subject_id).map((r) => [r.subject_id as string, r]));
  const standardByLevel = new Map(tuition.filter((r) => r.level).map((r) => [r.level as string, r]));
  // Every AS and A2 subject with the price it is charged at: its own price if set, else the standard for its level.
  const subjectPrices = ((aSubjects ?? []) as any[])
    .map((s) => {
      const own = ownPrice.get(s.id);
      const std = standardByLevel.get(s.level);
      return { ...s, amount: own ? Number(own.amount) : std ? Number(std.amount) : 0, own: !!own, since: (own ?? std)?.effective_from };
    })
    .sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "as" ? -1 : 1));
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
    for (const s of subjectPrices) {
      if (!s.active && !s.own) continue;
      options.push({
        value: `tuition|${aLevel.id}|${s.level}||${s.id}`,
        label: `${LEVEL_NAME[s.level] ?? s.level}: ${s.name}, own price per month`,
      });
    }
  }
  if (junior_) {
    options.push({ value: `admission|${junior_.id}||`, label: "Admission fee — Junior (one time)" });
    for (const c of classLevels ?? []) {
      options.push({ value: `tuition|${junior_.id}||${c.id}`, label: `Junior — ${c.name} (monthly)` });
    }
  }
  if (oLevel || aLevel) {
    // Global: the default fee for each mock exam (per subject), same for O Level, AS and A2.
    options.push({ value: `mock|||`, label: "Mock exam fee (per subject, O Level / AS / A2)" });
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
                    <td>{r.programme?.code === "junior" ? "Per student, one time" : "Per subject enrolled, one time (mock-only candidates pay it once)"}</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
                {tuition.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.programme?.name}{r.level ? ` (${r.level.toUpperCase()})` : ""}</b></td>
                    <td>{r.level ? "Per subject, per month (standard; a subject can have its own price below)" : "Per subject, per month"}</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
                {mock.map((r) => (
                  <tr key={r.id}>
                    <td><b>Mock exam fee (per subject)</b></td>
                    <td>Per mock exam (subject); default for new exams, same for O Level, AS and A2</td>
                    <td className="n mono"><b>{taka(r.amount)}</b></td>
                    <td className="mono sub">{fmtDate(r.effective_from)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {subjectPrices.length > 0 && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">AS and A2 subjects: monthly price</div>
              <div className="sub">Each subject is charged at its own price if set, else the standard AS or A2 price</div>
            </div>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Subject</th><th>Level</th><th className="n">Per month</th><th>Price</th><th>Since</th></tr></thead>
                <tbody>
                  {subjectPrices.map((s) => (
                    <tr key={s.id} style={s.active ? undefined : { opacity: 0.55 }}>
                      <td><b>{s.name}</b>{!s.active && <span className="sub"> (inactive)</span>}</td>
                      <td>{LEVEL_NAME[s.level] ?? s.level}</td>
                      <td className="n mono"><b>{taka(s.amount)}</b></td>
                      <td>
                        {s.own
                          ? <span className="st part"><span className="dot" />Own price</span>
                          : <span className="st past"><span className="dot" />Standard</span>}
                      </td>
                      <td className="mono sub">{s.since ? fmtDate(s.since) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="sub" style={{ padding: "10px 18px 14px" }}>
              To change one subject&apos;s price, use Change a rate and pick that subject. The new price applies to students
              added to the subject from then on; students already studying it keep the price they joined at.
            </div>
          </div>
        )}

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
                        ? "Mock exam fee (per subject)"
                        : r.class_level
                        ? `Junior — ${r.class_level.name}`
                        : r.subject
                        ? `${r.subject.name} (${LEVEL_NAME[r.subject.level] ?? ""}), own price`
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
