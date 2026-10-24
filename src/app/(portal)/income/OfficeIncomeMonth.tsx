import { createClient } from "@/lib/supabase/server";
import { monthName } from "@/lib/format";
import { ChargeButton, RemoveCharge, RuleForm } from "./ServiceForms";

const n = (v: unknown) => Number(v ?? 0);
const tk = (v: number) => (v < 0 ? "−৳" : "৳") + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });

type Charge = { id: string; teacher_id: string; teacher: string; kind: string; rate: number; base: number | null; amount: number; status: string; reason: string | null };
type TeacherRow = { teacher_id: string; teacher: string; rule_kind: string | null; rule_value: number | null; collection: number; expenses: number; service_charge: number };
type Canteen = { day: string; sales: number; cost: number; waste: number; profit: number };
type Month = { service_charges: Charge[]; admission: number; registration: number; other: number; canteen: Canteen[]; teachers: TeacherRow[] };

const ruleText = (kind: string | null, value: number | null) =>
  kind === "fixed" ? `${tk(n(value))} / month` : kind === "percent" ? `${n(value)}% of fee collection` : "None";

/** Office income for one month by heading: service charge (per teacher), admission fees,
 * registration fees, canteen profit/loss, other income. Then the service charge settings, the
 * Charge button and each teacher's balance for the month. */
export default async function OfficeIncomeMonth({ month, thisMonth, readOnly }: { month: string; thisMonth: string; readOnly: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_office_income_month", { p_month: `${month}-01` });
  const d = data as Month | null;
  if (!d) return null;
  const charges = d.service_charges ?? [];
  const charged = charges.filter((c) => c.status === "charged");
  const serviceTotal = charged.reduce((s, c) => s + n(c.amount), 0);
  const canteenTotal = (d.canteen ?? []).reduce((s, c) => s + n(c.profit), 0);
  const total = serviceTotal + n(d.admission) + n(d.registration) + canteenTotal + n(d.other);
  const byTeacher = new Map(charges.map((c) => [c.teacher_id, c]));

  return (
    <>
      <form method="GET" className="no-print" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input type="month" name="month" defaultValue={month} max={thisMonth} aria-label="Month"
          style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "8px 11px", fontSize: 13, background: "var(--paper)", color: "var(--ink)", fontFamily: "inherit" }} />
        <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "8px 12px" }}>Show</button>
        {month !== thisMonth && <a className="btn ghost" href="/income" style={{ fontSize: 12, padding: "8px 12px" }}>This month</a>}
      </form>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">Office income, {monthName(`${month}-01`)}</div>
          <div className="sub">Service charge and admission fees come from fees already collected, so the Cash balance doesn&apos;t add them again; canteen keeps its own cash.</div>
        </div>
        <div className="tblwrap">
          <table>
            <thead><tr><th>Heading</th><th>How it is worked out</th><th className="n">Amount</th></tr></thead>
            <tbody>
              <tr><td><b>Service charge</b></td><td className="sub">Charged per teacher (below){charged.length ? `: ${charged.length} teacher${charged.length === 1 ? "" : "s"}` : ", not charged yet"}</td><td className="n mono">{tk(serviceTotal)}</td></tr>
              <tr><td><b>Admission fees</b></td><td className="sub">Received this month; a part payment pays the admission fee first</td><td className="n mono">{tk(n(d.admission))}</td></tr>
              <tr><td><b>Registration fees</b></td><td className="sub">Entered below, with attachment</td><td className="n mono">{tk(n(d.registration))}</td></tr>
              <tr><td><b>Canteen profit / loss</b></td><td className="sub">{d.canteen.length} closed canteen day{d.canteen.length === 1 ? "" : "s"}: sales − cost of items sold − wasted items</td><td className="n mono" style={{ color: canteenTotal < 0 ? "var(--crit)" : undefined }}>{tk(canteenTotal)}</td></tr>
              <tr><td><b>Other income</b></td><td className="sub">Entered below, with attachment</td><td className="n mono">{tk(n(d.other))}</td></tr>
            </tbody>
            <tfoot><tr><td colSpan={2}><b>Total office income</b></td><td className="n mono"><b>{tk(total)}</b></td></tr></tfoot>
          </table>
        </div>
        {d.canteen.length > 0 && (
          <details>
            <summary className="sub" style={{ padding: "10px 18px", cursor: "pointer" }}>Canteen by day</summary>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Day</th><th className="n">Sales</th><th className="n">Cost sold</th><th className="n">Wasted</th><th className="n">Profit / loss</th></tr></thead>
                <tbody>
                  {d.canteen.map((c) => (
                    <tr key={c.day}><td className="mono">{c.day}</td><td className="n mono">{tk(n(c.sales))}</td><td className="n mono">{tk(n(c.cost))}</td><td className="n mono">{tk(n(c.waste))}</td><td className="n mono">{tk(n(c.profit))}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>

      <div className="panel">
        <div className="phead" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="ptitle">Service charge and teacher balances, {monthName(`${month}-01`)}</div>
          <div style={{ flex: 1 }} />
          {!readOnly && <ChargeButton month={month} label={charges.length ? "Charge again (recalculate)" : `Charge for ${monthName(`${month}-01`)}`} />}
        </div>
        <div className="sub" style={{ padding: "8px 18px 0" }}>
          Fee collection = the teacher&apos;s share of subject and mock fees received this month (admission fees excluded). Balance = fee collection − the teacher&apos;s expenses − service charge.
          {charges.length > 0 && " Charging again replaces this month's charges using the settings now."}
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Teacher</th><th className="n">Setting</th><th className="n">Fee collection</th><th className="n">Service charge</th>
                <th className="n">Expenses</th><th className="n">Balance</th>
              </tr>
            </thead>
            <tbody>
              {d.teachers.map((t) => {
                const c = byTeacher.get(t.teacher_id);
                const bal = n(t.collection) - n(t.expenses) - n(t.service_charge);
                return (
                  <tr key={t.teacher_id}>
                    <td><b>{t.teacher}</b></td>
                    <td className="n">{readOnly ? <span className="sub">{ruleText(t.rule_kind, t.rule_value)}</span> : <RuleForm teacherId={t.teacher_id} kind={t.rule_kind} value={t.rule_value == null ? null : n(t.rule_value)} />}</td>
                    <td className="n mono">{tk(n(t.collection))}</td>
                    <td className="n">
                      {c ? (
                        c.status === "charged" ? (
                          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                            <span className="mono">{tk(n(c.amount))}</span>
                            <span className="sub" style={{ fontSize: 11.5 }}>{c.kind === "percent" ? `${n(c.rate)}% of ${tk(n(c.base))}` : "fixed"}</span>
                            {!readOnly && <RemoveCharge id={c.id} />}
                          </span>
                        ) : <span className="sub">Removed: {c.reason}</span>
                      ) : <span className="sub">Not charged</span>}
                    </td>
                    <td className="n mono">{n(t.expenses) ? tk(-n(t.expenses)) : "-"}</td>
                    <td className="n mono"><b style={{ color: bal < 0 ? "var(--crit)" : undefined }}>{tk(bal)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
