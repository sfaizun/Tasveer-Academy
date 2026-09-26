import { createClient } from "@/lib/supabase/server";
import { taka, dhakaToday, dhakaTodayISO, currentBillingMonth, monthName } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <div className="lbl">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: tone ?? "var(--ink)", marginTop: 4 }}>
        {value}
      </div>
      <div className="sub">{sub}</div>
    </div>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();
  const month = currentBillingMonth();

  const [students, teachers, subjects, rates, invoices, payments, applications] = await Promise.all([
    supabase.from("student").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("teacher").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("subject").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("fee_rate").select("kind, programme_id, class_level_id, level, amount, effective_from, created_at"),
    supabase.from("invoice").select("net, paid, balance, status").eq("billing_month", month),
    supabase.from("payment").select("amount").eq("status", "confirmed").gte("received_on", month),
    supabase.from("application").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ]);

  const inv = invoices.data ?? [];
  const raised = inv.reduce((s, i) => s + Number(i.net), 0);
  const collected = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = inv.reduce((s, i) => s + Number(i.balance), 0);
  const rate = raised > 0 ? Math.round((collected / raised) * 100) : 0;
  const billingRun = inv.length > 0;

  // Fee rates are never edited in place: every change adds a new dated row, so older rows
  // (including the original ৳0 placeholders) stay as history. Only the rate currently in
  // effect for each fee item counts, i.e. the latest row whose effective date has arrived.
  const today = dhakaTodayISO();
  const currentRates = new Map<string, { amount: number; effective_from: string; created_at: string; junior: boolean }>();
  for (const r of rates.data ?? []) {
    if (!r.effective_from || r.effective_from > today) continue;
    const key = [r.kind, r.programme_id ?? "", r.class_level_id ?? "", r.level ?? ""].join("|");
    const cur = currentRates.get(key);
    if (!cur || r.effective_from > cur.effective_from || (r.effective_from === cur.effective_from && r.created_at > cur.created_at)) {
      currentRates.set(key, { amount: Number(r.amount), effective_from: r.effective_from, created_at: r.created_at, junior: !!r.class_level_id });
    }
  }
  const zeroRates = Array.from(currentRates.values()).filter((r) => r.amount <= 0);
  const zeroJunior = zeroRates.filter((r) => r.junior).length;

  return (
    <>
      <header className="top">
        <h1>Dashboard</h1>
        <div className="sub">{dhakaToday()}</div>
        <div className="spacer" />
        <span className="chip">{monthName(month)}</span>
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {!billingRun && (
          <div
            className="panel"
            style={{ padding: "16px 18px", borderLeft: "3px solid var(--coral)", background: "var(--coral-soft)" }}
          >
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>
              No billing run for {monthName(month)} yet
            </div>
            <div style={{ fontSize: 13 }}>
              Run it from <a href="/billing">Billing</a> once students are enrolled — one invoice
              per student is raised and these figures start moving.
            </div>
          </div>
        )}

        {(applications.count ?? 0) > 0 && (
          <div
            className="panel"
            style={{ padding: "16px 18px", borderLeft: "3px solid var(--blue)", background: "var(--tint2)" }}
          >
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>
              {applications.count} application{applications.count === 1 ? "" : "s"} waiting for review
            </div>
            <div style={{ fontSize: 13 }}>
              <a href="/applications">Review submitted admission forms →</a>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
          <Tile label="Collected this month" value={taka(collected)} sub={billingRun ? `${rate}% of raised` : "no invoices raised yet"} tone="var(--ok)" />
          <Tile label="Raised this month" value={taka(raised)} sub={`${inv.length} invoices`} />
          <Tile label="Outstanding" value={taka(outstanding)} sub="including arrears" tone={outstanding > 0 ? "var(--crit)" : undefined} />
          <Tile label="Active students" value={String(students.count ?? 0)} sub="enrolled and billable" />
        </div>

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Academy setup</div>
            <div className="sub">What is loaded and ready</div>
          </div>
          <div className="tblwrap">
            <table>
              <tbody>
                <tr>
                  <td><b>Teachers</b><div className="sub">Loaded with subject mapping</div></td>
                  <td className="n mono"><b>{teachers.count ?? 0}</b></td>
                  <td style={{ width: 120 }}><span className="st paid"><span className="dot" />Ready</span></td>
                </tr>
                <tr>
                  <td><b>Subjects</b><div className="sub">O Level and A Level, AS and A2 rows</div></td>
                  <td className="n mono"><b>{subjects.count ?? 0}</b></td>
                  <td><span className="st paid"><span className="dot" />Ready</span></td>
                </tr>
                <tr>
                  <td>
                    <b>Fee rates</b>
                    <div className="sub">
                      {zeroRates.length > 0
                        ? `${zeroRates.length} current rate${zeroRates.length === 1 ? "" : "s"} still at zero` +
                          (zeroJunior > 0 ? ` (${zeroJunior} junior class)` : "")
                        : "All current rates set"}
                    </div>
                  </td>
                  <td className="n mono"><b>{currentRates.size}</b></td>
                  <td>
                    {zeroRates.length > 0
                      ? <span className="st past"><span className="dot" />Needs amounts</span>
                      : <span className="st paid"><span className="dot" />Ready</span>}
                  </td>
                </tr>
                <tr>
                  <td><b>Students</b><div className="sub">Admission → enrolment is live</div></td>
                  <td className="n mono"><b>{students.count ?? 0}</b></td>
                  <td>
                    {(students.count ?? 0) > 0
                      ? <span className="st paid"><span className="dot" />In progress</span>
                      : <span className="st due"><span className="dot" />Not started</span>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
