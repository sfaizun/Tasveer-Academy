import { createClient } from "@/lib/supabase/server";
import { taka, dhakaToday, currentBillingMonth, monthName } from "@/lib/format";
import ThemeToggle from "@/components/ThemeToggle";

export const dynamic = "force-dynamic";

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

export default async function Dashboard() {
  const supabase = await createClient();
  const month = currentBillingMonth();

  const [students, teachers, subjects, rates, invoices, payments, unsetRates] = await Promise.all([
    supabase.from("student").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("teacher").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("subject").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("fee_rate").select("id", { count: "exact", head: true }),
    supabase.from("invoice").select("net, paid, balance, status").eq("billing_month", month),
    supabase.from("payment").select("amount").eq("status", "confirmed").gte("received_on", month),
    supabase.from("fee_rate").select("id", { count: "exact", head: true }).eq("amount", 0),
  ]);

  const inv = invoices.data ?? [];
  const raised = inv.reduce((s, i) => s + Number(i.net), 0);
  const collected = (payments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = inv.reduce((s, i) => s + Number(i.balance), 0);
  const rate = raised > 0 ? Math.round((collected / raised) * 100) : 0;
  const billingRun = inv.length > 0;

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
              The academy foundation is in place. Once students are enrolled, the monthly run
              raises one invoice per student and these figures start moving.
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
                      {(unsetRates.count ?? 0) > 0
                        ? `${unsetRates.count} junior class rates still at zero`
                        : "all rates set"}
                    </div>
                  </td>
                  <td className="n mono"><b>{rates.count ?? 0}</b></td>
                  <td>
                    {(unsetRates.count ?? 0) > 0
                      ? <span className="st past"><span className="dot" />Needs amounts</span>
                      : <span className="st paid"><span className="dot" />Ready</span>}
                  </td>
                </tr>
                <tr>
                  <td><b>Students</b><div className="sub">Admission opens in the next phase</div></td>
                  <td className="n mono"><b>{students.count ?? 0}</b></td>
                  <td><span className="st due"><span className="dot" />Not started</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
