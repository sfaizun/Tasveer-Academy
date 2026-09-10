import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, currentBillingMonth } from "@/lib/format";
import RunBillingForm from "./RunBillingForm";

export const dynamic = "force-dynamic";

const statusMap: Record<string, { cls: string; label: string }> = {
  draft: { cls: "due", label: "Draft" },
  unpaid: { cls: "due", label: "Unpaid" },
  partly_paid: { cls: "part", label: "Partly paid" },
  paid: { cls: "paid", label: "Paid" },
  waived: { cls: "past", label: "Waived" },
  void: { cls: "over", label: "Void" },
};

export default async function BillingPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoice")
    .select("id, invoice_no, billing_month, due_on, net, paid, balance, status, student(id, reg_no, full_name)")
    .order("billing_month", { ascending: false })
    .order("due_on", { ascending: true })
    .limit(200);

  const defaultMonth = currentBillingMonth().slice(0, 7);

  return (
    <>
      <header className="top">
        <h1>Billing</h1>
        <div className="sub">Monthly invoice run — one invoice per student per month, never duplicated</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead"><div className="ptitle">Run monthly billing</div></div>
          <div style={{ padding: 18 }}>
            <RunBillingForm defaultMonth={defaultMonth} />
          </div>
        </div>

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Invoices</div>
            <div className="sub">{(invoices ?? []).length} most recent</div>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Student</th>
                  <th>Month</th>
                  <th>Due</th>
                  <th className="n">Net</th>
                  <th className="n">Paid</th>
                  <th className="n">Balance</th>
                  <th className="n">Status</th>
                </tr>
              </thead>
              <tbody>
                {(invoices ?? []).map((inv: any) => {
                  const m = statusMap[inv.status] ?? { cls: "due", label: inv.status };
                  return (
                    <tr key={inv.id}>
                      <td className="mono"><b>{inv.invoice_no}</b></td>
                      <td>
                        <a href={`/students/${inv.student?.id}`}>
                          {inv.student?.full_name} <span className="sub mono">({inv.student?.reg_no})</span>
                        </a>
                      </td>
                      <td className="mono sub">{inv.billing_month}</td>
                      <td className="mono sub">{inv.due_on}</td>
                      <td className="n mono">{taka(inv.net)}</td>
                      <td className="n mono">{taka(inv.paid)}</td>
                      <td className="n mono">{taka(inv.balance)}</td>
                      <td className="n"><span className={`st ${m.cls}`}><span className="dot" />{m.label}</span></td>
                    </tr>
                  );
                })}
                {(invoices ?? []).length === 0 && (
                  <tr><td colSpan={8} className="sub">No invoices yet. Run billing above, or approve an admission application.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
