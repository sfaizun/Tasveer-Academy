import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PrintButton from "@/components/PrintButton";
import { fmtDate, taka } from "@/lib/format";
import AutoPrint from "./AutoPrint";

export const dynamic = "force-dynamic";

const LINE_LABEL: Record<string, string> = {
  admission: "Admission fee",
  tuition: "Tuition",
  mock: "Mock exam",
  adjustment: "Other charge",
};
const STATUS: Record<string, string> = {
  unpaid: "Unpaid",
  partly_paid: "Partly paid",
  paid: "Paid",
  waived: "Waived",
  void: "Void",
  draft: "Draft",
};
const METHOD: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", card: "Card" };

/** One invoice as a clean, printable document. Readable by whoever can see the invoice
 * (admin, or the student/guardian it belongs to); ?print=1 opens the print dialog. */
export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const { print } = await searchParams;
  const supabase = await createClient();

  const { data: inv } = await supabase
    .from("invoice")
    .select(
      `id, invoice_no, billing_month, issued_on, due_on, gross, discount, net, paid, balance, status,
       student(id, reg_no, full_name, phone, programme(name), class_level(name), guardian(full_name, phone, is_primary)),
       invoice_line(id, type, description, rate, quantity, amount, applies_to_line_id, created_at),
       payment_allocation(amount, payment(receipt_no, received_on, method, status))`
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "invoice_line" })
    .maybeSingle();
  if (!inv) notFound();

  const i: any = inv;
  const s = i.student ?? {};
  const guardian = ((s.guardian ?? []) as any[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  const lines = (i.invoice_line ?? []) as any[];
  const charges = lines.filter((l) => l.type !== "discount");
  const loose = lines.filter((l) => l.type === "discount" && !charges.some((c) => c.id === l.applies_to_line_id));
  const payments = ((i.payment_allocation ?? []) as any[]).filter((a) => a.payment?.status === "confirmed");
  const minus = (n: number) => "− " + taka(Math.abs(Number(n)));

  return (
    <>
      {print === "1" && <AutoPrint />}
      <header className="top no-print">
        <h1>Invoice {i.invoice_no}</h1>
        <div className="spacer" />
        {s.id && (
          <a className="btn ghost" href={`/students/${s.id}`} style={{ fontSize: 12, padding: "6px 10px" }}>
            Back to student
          </a>
        )}
        <PrintButton label="Print invoice" />
      </header>

      <div className="content">
        <div className="panel inv-doc">
          <div className="inv-doc-head">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Tasveer Academy" className="inv-doc-logo" />
            <div>
              <div className="inv-doc-name">Tasveer Academy</div>
              <div className="sub">105/A (2nd &amp; 3rd Floor), Kakrail, Dhaka 1000</div>
            </div>
            <div className="spacer" />
            <div style={{ textAlign: "right" }}>
              <div className="inv-doc-title">INVOICE</div>
              <div className="mono"><b>{i.invoice_no}</b></div>
              <div className="sub">{STATUS[i.status] ?? i.status}</div>
            </div>
          </div>

          <div className="inv-doc-meta">
            <div>
              <div className="lbl">Billed to</div>
              <b style={{ color: "var(--ink)" }}>{s.full_name}</b>
              <div className="sub mono">{s.reg_no}</div>
              <div className="sub">
                {s.programme?.name}
                {s.class_level?.name ? `, ${s.class_level.name}` : ""}
              </div>
              {guardian && <div className="sub">Guardian: {guardian.full_name}{guardian.phone ? `, ${guardian.phone}` : ""}</div>}
              {!guardian && s.phone && <div className="sub">{s.phone}</div>}
            </div>
            <div>
              <div className="lbl">Billing month</div>
              <div className="mono">{fmtDate(i.billing_month)}</div>
              <div className="lbl" style={{ marginTop: 8 }}>Issued</div>
              <div className="mono">{fmtDate(i.issued_on)}</div>
              <div className="lbl" style={{ marginTop: 8 }}>Due</div>
              <div className="mono">{fmtDate(i.due_on)}</div>
            </div>
          </div>

          <table className="inv-doc-lines">
            <thead>
              <tr><th>Item</th><th>Description</th><th className="n">Amount</th></tr>
            </thead>
            <tbody>
              {charges.map((l) => (
                <Fragment key={l.id}>
                  <tr>
                    <td className="sub">{LINE_LABEL[l.type] ?? l.type}</td>
                    <td>{l.description}</td>
                    <td className="n mono">{taka(l.amount)}</td>
                  </tr>
                  {lines
                    .filter((d) => d.type === "discount" && d.applies_to_line_id === l.id)
                    .map((d) => (
                      <tr key={d.id} className="inv-doc-disc">
                        <td></td>
                        <td className="sub">{d.description}</td>
                        <td className="n mono">{minus(d.amount)}</td>
                      </tr>
                    ))}
                </Fragment>
              ))}
              {loose.map((d) => (
                <tr key={d.id} className="inv-doc-disc">
                  <td className="sub">Discount</td>
                  <td className="sub">{d.description}</td>
                  <td className="n mono">{minus(d.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="inv-doc-totals">
            <div><span>Gross</span><b className="mono">{taka(i.gross)}</b></div>
            <div><span>Discount</span><b className="mono">{Number(i.discount) > 0 ? minus(i.discount) : taka(0)}</b></div>
            <div className="strong"><span>Total</span><b className="mono">{taka(i.net)}</b></div>
            <div><span>Paid</span><b className="mono">{taka(i.paid)}</b></div>
            <div className="strong"><span>Balance due</span><b className="mono">{taka(i.balance)}</b></div>
          </div>

          {payments.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="lbl" style={{ marginBottom: 6 }}>Payments received</div>
              <table className="inv-doc-lines">
                <tbody>
                  {payments.map((a, k) => (
                    <tr key={k}>
                      <td className="mono">{a.payment?.receipt_no}</td>
                      <td className="sub">{fmtDate(a.payment?.received_on)} · {METHOD[a.payment?.method] ?? a.payment?.method}</td>
                      <td className="n mono">{taka(a.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sub" style={{ marginTop: 22, textAlign: "center" }}>
            Thank you. Please quote the invoice number when paying.
          </div>
        </div>
      </div>
    </>
  );
}
