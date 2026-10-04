import Link from "next/link";
import type { createClient } from "@/lib/supabase/server";
import ExportCsvButton from "@/components/ExportCsvButton";
import { taka } from "@/lib/format";
import { subjectLabel } from "@/lib/mock";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Mock exam fees by series and subject: charged, collected and still due. A payment settles a
 * whole invoice, so a mock fee's "collected" is its share of what was paid on that invoice. */
export default async function MockFeesReport({
  supabase, monthDate, fileTag,
}: {
  supabase: Supabase;
  monthDate: string | null;
  fileTag: string;
}) {
  const { data } = await supabase
    .from("mock_registration")
    .select(
      `id, status, mock_exam(id, series, exam_date, subject(name, level, programme(code))), subject(name, level, programme(code)),
       invoice_line(id, amount, invoice(billing_month, net, paid, balance, status))`
    )
    .not("invoice_line_id", "is", null);

  // Discounts given on a mock fee (Edit invoice) reduce what was charged for it.
  const lineIds = ((data ?? []) as any[]).map((r) => r.invoice_line?.id).filter(Boolean) as string[];
  const discByLine = new Map<string, number>();
  if (lineIds.length) {
    const { data: discs } = await supabase
      .from("invoice_line")
      .select("applies_to_line_id, amount")
      .eq("type", "discount")
      .in("applies_to_line_id", lineIds);
    for (const d of (discs ?? []) as any[]) {
      discByLine.set(d.applies_to_line_id, (discByLine.get(d.applies_to_line_id) ?? 0) + Math.abs(Number(d.amount)));
    }
  }

  type Row = {
    key: string; examId: string | null; series: string; date: string | null; subject: string;
    candidates: number; sat: number; absent: number; charged: number; collected: number; due: number;
  };
  const rows = new Map<string, Row>();
  for (const r of (data ?? []) as any[]) {
    const line = r.invoice_line;
    const inv = line?.invoice;
    if (!line || !inv || inv.status === "void") continue;
    if (monthDate && inv.billing_month !== monthDate) continue;
    const amt = Number(line.amount) - (discByLine.get(line.id) ?? 0);
    const net = Number(inv.net);
    const share = net > 0 ? amt / net : 0;
    const key = r.mock_exam?.id ?? `subject:${subjectLabel(r.subject)}`;
    const row = rows.get(key) ?? {
      key,
      examId: r.mock_exam?.id ?? null,
      series: r.mock_exam?.series ?? "No series",
      date: r.mock_exam?.exam_date ?? null,
      subject: subjectLabel(r.mock_exam?.subject ?? r.subject),
      candidates: 0, sat: 0, absent: 0, charged: 0, collected: 0, due: 0,
    };
    if (r.status !== "withdrawn") row.candidates += 1;
    if (r.status === "sat") row.sat += 1;
    if (r.status === "absent") row.absent += 1;
    row.charged += amt;
    row.collected += share * Number(inv.paid);
    row.due += share * Number(inv.balance);
    rows.set(key, row);
  }
  const list = [...rows.values()].sort((a, b) => a.series.localeCompare(b.series) || a.subject.localeCompare(b.subject));
  const tot = list.reduce(
    (a, r) => ({ c: a.c + r.candidates, ch: a.ch + r.charged, co: a.co + r.collected, d: a.d + r.due }),
    { c: 0, ch: 0, co: 0, d: 0 },
  );

  return (
    <details className="panel collapsible" open>
      <summary className="phead" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ptitle">Mock exam fees</div>
        <div className="sub">By series and subject; kept out of the By subject / By teacher tuition figures</div>
        <div className="spacer" />
        <ExportCsvButton
          filename={`mock-exam-fees-${fileTag}`}
          headers={["Series", "Subject", "Candidates", "Sat", "Absent", "Charged", "Collected", "Due"]}
          rows={list.map((r) => [r.series, r.subject, r.candidates, r.sat, r.absent, r.charged, Math.round(r.collected * 100) / 100, Math.round(r.due * 100) / 100])}
        />
      </summary>
      <div style={{ padding: "14px 18px 4px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
        <div><div className="lbl">Candidates</div><b className="mono">{tot.c}</b></div>
        <div><div className="lbl">Charged</div><b className="mono">{taka(tot.ch)}</b></div>
        <div><div className="lbl">Collected</div><b className="mono" style={{ color: "var(--ok)" }}>{taka(tot.co)}</b></div>
        <div><div className="lbl">Due</div><b className="mono" style={{ color: tot.d > 0.5 ? "var(--crit)" : undefined }}>{taka(tot.d)}</b></div>
      </div>
      <div className="tblwrap">
        <table>
          <thead>
            <tr><th>Series</th><th>Subject</th><th className="n">Candidates</th><th className="n">Sat / absent</th><th className="n">Charged</th><th className="n">Collected</th><th className="n">Due</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.key}>
                <td className="sub">{r.series}</td>
                <td>{r.examId ? <Link href={`/mock-exams/${r.examId}`}><b>{r.subject}</b></Link> : <b>{r.subject}</b>}</td>
                <td className="n mono">{r.candidates}</td>
                <td className="n mono">{r.sat} / {r.absent}</td>
                <td className="n mono">{taka(r.charged)}</td>
                <td className="n mono">{taka(r.collected)}</td>
                <td className="n mono" style={{ color: r.due > 0.5 ? "var(--crit)" : undefined }}>{taka(r.due)}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="sub">No mock exam fees{monthDate ? " billed in this month" : " yet"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </details>
  );
}
