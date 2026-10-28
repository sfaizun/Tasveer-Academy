"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import PrintSectionButton from "@/components/PrintSectionButton";
import { fmtDate, fmtDateTime, monthName, taka } from "@/lib/format";
import { buildXlsx, saveBlob, type XlsxCell } from "@/lib/xlsx";
import { CATEGORY_LABEL, METHOD_LABEL, type CollectionRow, type RefundCollectionRow, type VoidRow } from "./types";

const r2 = (n: number) => Math.round(n * 100) / 100;
const methodLabel = (m: string) => METHOD_LABEL[m] ?? m;
const feeMonth = (r: CollectionRow) => (r.category === "advance" ? "Not yet applied" : r.billing_month ? monthName(r.billing_month) : "");
const classSection = (r: { class_label: string | null; section: string | null }) =>
  [r.class_label, r.section ? `Batch ${r.section}` : null].filter(Boolean).join(", ");
/** Amounts for the PDF: its standard fonts have no taka sign. */
const tk = (n: number) => "Tk " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BASIS = "Cash basis: every payment is counted in the month it was received, whatever month, invoice or session it paid for, and every refund is deducted in the month it was given. Unpaid invoices and voided receipts are never counted.";

const sel: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "7px 10px", fontSize: 12.5,
  background: "var(--paper)", color: "var(--ink)", maxWidth: "100%", fontFamily: "inherit",
};
const linkBtn: React.CSSProperties = {
  background: "none", border: 0, padding: 0, font: "inherit", color: "var(--coral-dk)", cursor: "pointer", textAlign: "left", fontWeight: 600,
};

type StudentGroup = { id: string; name: string; reg: string; cls: string; rows: CollectionRow[]; total: number; txns: number };

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel" style={{ padding: "16px 18px" }}>
      <div className="lbl">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export default function FeeCollectionReport({ rows, voids, refunds = [], month, monthLabel, period, full, scopeLabel, linkStudents, linkInvoices }: {
  rows: CollectionRow[];
  voids: VoidRow[];
  refunds?: RefundCollectionRow[];
  month: string;
  monthLabel: string;
  period: string;
  full: boolean;
  scopeLabel: string;
  linkStudents: boolean;
  linkInvoices: boolean;
}) {
  const [q, setQ] = useState("");
  const [method, setMethod] = useState("");
  const [category, setCategory] = useState("");
  const [teacher, setTeacher] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Bring a student's receipts into view when their name or total is selected.
  useEffect(() => { if (open) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [open]);

  const teachers = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of [...rows, ...refunds]) if (r.teacher_id) m.set(r.teacher_id, r.teacher_name ?? "Teacher");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, refunds]);
  const methods = useMemo(() => [...new Set([...rows, ...refunds].map((r) => r.method))].sort(), [rows, refunds]);
  const categories = useMemo(() => Object.keys(CATEGORY_LABEL).filter((c) => rows.some((r) => r.category === c) || refunds.some((r) => r.category === c)), [rows, refunds]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      (!method || r.method === method)
      && (!category || r.category === category)
      && (!teacher || (teacher === "office" ? !r.teacher_id : r.teacher_id === teacher))
      && (!s || [r.student_name, r.reg_no, r.receipt_no, r.invoice_no ?? "", r.item].some((x) => x.toLowerCase().includes(s))));
  }, [rows, q, method, category, teacher]);
  // Refunds given in the month, with the same filters.
  const refundsShown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return refunds.filter((r) =>
      (!method || r.method === method)
      && (!category || r.category === category)
      && (!teacher || (teacher === "office" ? !r.teacher_id : r.teacher_id === teacher))
      && (!s || [r.student_name, r.reg_no, r.refund_no, r.invoice_no ?? "", r.item].some((x) => x.toLowerCase().includes(s))));
  }, [refunds, q, method, category, teacher]);
  const refundTotal = r2(refundsShown.reduce((n, r) => n + r.amount, 0));
  const refundCount = new Set(refundsShown.map((r) => r.refund_id)).size;

  const groups: StudentGroup[] = useMemo(() => {
    const m = new Map<string, StudentGroup>();
    for (const r of filtered) {
      let g = m.get(r.student_id);
      if (!g) {
        g = { id: r.student_id, name: r.student_name, reg: r.reg_no, cls: r.class_label ?? "", rows: [], total: 0, txns: 0 };
        m.set(r.student_id, g);
      }
      g.rows.push(r);
      g.total = r2(g.total + r.amount);
    }
    for (const g of m.values()) {
      g.rows.sort((a, b) => a.received_on.localeCompare(b.received_on) || (a.received_at ?? "").localeCompare(b.received_at ?? "")
        || a.receipt_no.localeCompare(b.receipt_no) || b.amount - a.amount);
      g.txns = new Set(g.rows.map((r) => r.payment_id)).size;
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name) || a.reg.localeCompare(b.reg));
  }, [filtered]);

  // Serial numbers: one per transaction (receipt), in the order the table shows them.
  const serial = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) for (const r of g.rows) if (!m.has(r.payment_id)) m.set(r.payment_id, m.size + 1);
    return m;
  }, [groups]);

  const summary = useMemo(() => {
    const total = r2(filtered.reduce((n, r) => n + r.amount, 0));
    const by = (key: (r: CollectionRow) => string) => {
      const m = new Map<string, { amount: number; txns: Set<string> }>();
      for (const r of filtered) {
        const k = key(r);
        const e = m.get(k) ?? { amount: 0, txns: new Set<string>() };
        e.amount = r2(e.amount + r.amount);
        e.txns.add(r.payment_id);
        m.set(k, e);
      }
      return [...m.entries()].map(([label, e]) => ({ label, amount: e.amount, txns: e.txns.size })).sort((a, b) => b.amount - a.amount);
    };
    return {
      total,
      students: new Set(filtered.map((r) => r.student_id)).size,
      txns: new Set(filtered.map((r) => r.payment_id)).size,
      teacherFees: r2(filtered.filter((r) => r.category === "tuition" || r.category === "mock").reduce((n, r) => n + r.amount, 0)),
      officeIncome: r2(filtered.filter((r) => r.category === "admission" || r.category === "other").reduce((n, r) => n + r.amount, 0)),
      advance: r2(filtered.filter((r) => r.category === "advance").reduce((n, r) => n + r.amount, 0)),
      byCategory: by((r) => CATEGORY_LABEL[r.category] ?? r.category),
      bySubject: by((r) => r.item),
      byMethod: by((r) => methodLabel(r.method)),
      byTeacher: by((r) => r.teacher_name ?? "Office income (no teacher)"),
    };
  }, [filtered]);

  const filterText = [
    q.trim() && `Search "${q.trim()}"`,
    method && `Method: ${methodLabel(method)}`,
    category && `Category: ${CATEGORY_LABEL[category] ?? category}`,
    teacher && `Teacher: ${teacher === "office" ? "Office income (no teacher)" : teachers.find((t) => t[0] === teacher)?.[1] ?? ""}`,
  ].filter(Boolean).join("; ") || "None";
  const anyFilter = filterText !== "None";
  const generated = () => fmtDateTime(new Date().toISOString());
  const fileBase = `fees-collection-${month}${full ? "" : "-my-subjects"}`;

  const DETAIL_HEAD = ["#", "Student ID", "Student name", "Class / section", "Payment date", "Receipt no.", "Invoice no.", "Fee category / subject", "Fee month(s)", "Method", "Amount"];
  const detailCells = (r: CollectionRow): XlsxCell[] => [
    serial.get(r.payment_id) ?? "", r.reg_no, r.student_name, classSection(r), fmtDate(r.received_on), r.receipt_no, r.invoice_no ?? "",
    r.item + (full && r.teacher_name ? ` (${r.teacher_name})` : ""), feeMonth(r), methodLabel(r.method), r.amount,
  ];
  const infoRows = (title: string): XlsxCell[][] => [
    [`Tasveer Academy: ${title}`],
    ["Month", monthLabel],
    ["Period", period],
    ["Showing", scopeLabel],
    ["Filters", filterText],
    ["Basis", BASIS],
    ["Generated", generated()],
    [],
  ];
  const summaryRows = (): { rows: XlsxCell[][]; bold: number[] } => {
    const out: XlsxCell[][] = [];
    const bold: number[] = [];
    const head = (cells: XlsxCell[]) => { bold.push(out.length); out.push(cells); };
    head(["Summary", "Amount", "Transactions"]);
    out.push(["Total fees collected", summary.total, summary.txns]);
    out.push(["Total students paid", null, summary.students]);
    out.push(["Total transactions", null, summary.txns]);
    if (refundsShown.length) {
      out.push(["Refunds given (deducted)", -refundTotal, refundCount]);
      out.push(["Net collection", r2(summary.total - refundTotal)]);
    }
    if (full) {
      out.push(["Teacher fees (tuition and mock)", summary.teacherFees]);
      out.push(["Office income (admission and other)", summary.officeIncome]);
      if (summary.advance) out.push(["Advance (not yet applied)", summary.advance]);
    }
    out.push([]);
    head([full ? "By fee category" : "By subject", "Amount", "Transactions"]);
    for (const c of full ? summary.byCategory : summary.bySubject) out.push([c.label, c.amount, c.txns]);
    out.push([]);
    head(["By payment method", "Amount", "Transactions"]);
    for (const c of summary.byMethod) out.push([c.label, c.amount, c.txns]);
    if (full) {
      out.push([]);
      head(["By teacher", "Amount", "Transactions"]);
      for (const c of summary.byTeacher) out.push([c.label, c.amount, c.txns]);
    }
    if (voids.length) {
      out.push([]);
      head(["Voided receipts (not counted)", "Amount", "Receipts"]);
      out.push(["Voided", r2(voids.reduce((n, v) => n + v.amount, 0)), voids.length]);
    }
    return { rows: out, bold };
  };

  function excelDetail() {
    const info = infoRows("Monthly Fees Collection, transactions");
    const out: XlsxCell[][] = [...info, DETAIL_HEAD];
    const bold = [info.length];
    for (const g of groups) {
      for (const r of g.rows) out.push(detailCells(r));
      bold.push(out.length);
      out.push(["", "", `Total for ${g.name}`, "", "", "", "", `${g.txns} ${g.txns === 1 ? "transaction" : "transactions"}`, "", "", g.total]);
    }
    bold.push(out.length);
    out.push(["", "", "Total fees collected", "", "", "", "", `${summary.txns} transactions, ${summary.students} students`, "", "", summary.total]);
    const totals: XlsxCell[][] = [["#", "Student ID", "Student name", "Class / section", "Transactions", "Amount"],
      ...groups.map((g, i) => [i + 1, g.reg, g.name, classSection(g.rows[0]), g.txns, g.total] as XlsxCell[]),
      ["", "", "Total", "", summary.txns, summary.total]];
    const sheets = [
      { name: "Transactions", rows: out, boldRows: bold, moneyCols: [10], widths: [6, 14, 26, 22, 13, 15, 15, 34, 16, 10, 14] },
      { name: "Student totals", rows: totals, boldRows: [totals.length - 1], moneyCols: [5], widths: [6, 14, 26, 22, 13, 14] },
    ];
    if (refundsShown.length) {
      const rr: XlsxCell[][] = [["Refund no.", "Refund date", "Student ID", "Student name", "Class / section", "Invoice no.", "Fee refunded", "Fee month(s)", "Method", "Reason", "Amount"],
        ...refundsShown.map((r) => [r.refund_no, fmtDate(r.refunded_on), r.reg_no, r.student_name, classSection(r), r.invoice_no ?? "",
          r.item + (full && r.teacher_name ? ` (${r.teacher_name})` : ""), r.billing_month ? monthName(r.billing_month) : "", methodLabel(r.method), r.reason, -r.amount] as XlsxCell[]),
        ["", "", "", "Total refunds", "", "", "", "", "", "", -refundTotal],
        ["", "", "", "Net collection", "", "", "", "", "", "", r2(summary.total - refundTotal)]];
      sheets.push({ name: "Refunds", rows: rr, boldRows: [rr.length - 2, rr.length - 1], moneyCols: [10], widths: [15, 13, 14, 26, 22, 15, 34, 16, 10, 36, 14] });
    }
    if (voids.length) {
      sheets.push({
        name: "Voided (not counted)",
        rows: [["Receipt no.", "Student ID", "Student name", "Received on", "Voided on", "Method", "Amount", "Reason"],
          ...voids.map((v) => [v.receipt_no, v.reg_no, v.student_name, fmtDate(v.received_on), fmtDate(v.voided_on), methodLabel(v.method), v.amount, v.void_reason ?? ""] as XlsxCell[])],
        boldRows: [], moneyCols: [6], widths: [15, 14, 26, 13, 13, 10, 14, 40],
      });
    }
    saveBlob(buildXlsx(sheets), `${fileBase}-transactions.xlsx`);
  }

  function excelSummary() {
    const info = infoRows("Monthly Fees Collection, summary");
    const s = summaryRows();
    saveBlob(buildXlsx([{ name: "Summary", rows: [...info, ...s.rows], boldRows: s.bold.map((b) => b + info.length), moneyCols: [1], widths: [40, 16, 14] }]),
      `${fileBase}-summary.xlsx`);
  }

  async function pdf(kind: "detail" | "summary") {
    setBusy(kind);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: kind === "detail" ? "landscape" : "portrait", unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(`Tasveer Academy: Monthly Fees Collection${kind === "summary" ? " (summary)" : ""}`, 40, 46);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      const info = [`Month: ${monthLabel}`, `Period: ${period}`, `Showing: ${scopeLabel}`, `Filters: ${filterText}`, `Generated: ${generated()}`];
      let y = 64;
      for (const line of info) { doc.text(line, 40, y); y += 13; }
      const basis = doc.splitTextToSize(BASIS, W - 80) as string[];
      doc.setTextColor(110);
      doc.text(basis, 40, y);
      doc.setTextColor(0);
      y += basis.length * 12 + 8;
      const coral: [number, number, number] = [210, 74, 61];
      const base = { theme: "grid" as const, styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: coral, textColor: 255 }, margin: { left: 40, right: 40 } };
      const after = () => ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18;

      if (kind === "summary") {
        const s = summaryRows();
        const blocks: string[][][] = [];
        let cur: string[][] = [];
        for (const r of s.rows) {
          if (!r.length) { if (cur.length) blocks.push(cur); cur = []; continue; }
          cur.push(r.map((c, i) => (typeof c === "number" ? (i === 1 ? tk(c) : String(c)) : String(c ?? ""))));
        }
        if (cur.length) blocks.push(cur);
        for (const b of blocks) {
          autoTable(doc, { ...base, startY: y, head: [b[0]], body: b.slice(1), columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } });
          y = after();
        }
      } else {
        const body: (string | { content: string; styles: Record<string, unknown> })[][] = [];
        const boldRow = (cells: string[]) => cells.map((c) => ({ content: c, styles: { fontStyle: "bold", fillColor: [247, 241, 236] } }));
        for (const g of groups) {
          g.rows.forEach((r, i) => {
            const first = i === 0 || g.rows[i - 1].payment_id !== r.payment_id;
            const c = detailCells(r);
            body.push([first ? String(c[0]) : "", c[1] as string, c[2] as string, c[3] as string, first ? String(c[4]) : "", first ? String(c[5]) : "", String(c[6]), String(c[7]), String(c[8]), first ? String(c[9]) : "", tk(r.amount)]);
          });
          body.push(boldRow(["", "", `Total for ${g.name}`, "", "", "", "", `${g.txns} ${g.txns === 1 ? "transaction" : "transactions"}`, "", "", tk(g.total)]));
        }
        body.push(boldRow(["", "", "Total fees collected", "", "", "", "", `${summary.txns} transactions, ${summary.students} students`, "", "", tk(summary.total)]));
        autoTable(doc, { ...base, startY: y, head: [DETAIL_HEAD], body, styles: { fontSize: 7.5, cellPadding: 3.5 }, columnStyles: { 0: { cellWidth: 22 }, 10: { halign: "right", cellWidth: 70 } } });
        y = after();
        if (refundsShown.length) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Refunds given (deducted in this month)", 40, y);
          autoTable(doc, { ...base, startY: y + 8, head: [["Refund no.", "Date", "Student ID", "Student name", "Invoice no.", "Fee refunded", "Fee month(s)", "Method", "Reason", "Amount"]],
            body: [
              ...refundsShown.map((r) => [r.refund_no, fmtDate(r.refunded_on), r.reg_no, r.student_name, r.invoice_no ?? "", r.item + (full && r.teacher_name ? ` (${r.teacher_name})` : ""),
                r.billing_month ? monthName(r.billing_month) : "", methodLabel(r.method), r.reason, "- " + tk(r.amount)]),
              ["", "", "", "Total refunds", "", "", "", "", "", "- " + tk(refundTotal)].map((c) => ({ content: c, styles: { fontStyle: "bold" } })),
              ["", "", "", "Net collection", "", "", "", "", "", tk(r2(summary.total - refundTotal))].map((c) => ({ content: c, styles: { fontStyle: "bold" } })),
            ],
            styles: { fontSize: 7.5, cellPadding: 3.5 }, columnStyles: { 9: { halign: "right" } } });
          y = after();
        }
        if (voids.length) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.text("Voided receipts (shown for transparency, not counted)", 40, y);
          autoTable(doc, { ...base, startY: y + 8, head: [["Receipt no.", "Student ID", "Student name", "Received on", "Voided on", "Method", "Amount", "Reason"]],
            body: voids.map((v) => [v.receipt_no, v.reg_no, v.student_name, fmtDate(v.received_on), fmtDate(v.voided_on), methodLabel(v.method), tk(v.amount), v.void_reason ?? ""]),
            columnStyles: { 6: { halign: "right" } } });
        }
      }
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`${monthLabel} · Page ${p} of ${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
      }
      doc.save(`${fileBase}-${kind === "detail" ? "transactions" : "summary"}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  const openGroup = open ? groups.find((g) => g.id === open) ?? null : null;
  const receipts = (g: StudentGroup) => {
    const m = new Map<string, CollectionRow[]>();
    for (const r of g.rows) m.set(r.payment_id, [...(m.get(r.payment_id) ?? []), r]);
    return [...m.values()];
  };
  const printHead = (title: string) => (
    <div className="print-only" style={{ padding: "0 0 12px" }}>
      <div style={{ fontSize: 16, fontWeight: 700 }}>Tasveer Academy: {title}</div>
      <div className="sub">Month: {monthLabel} · {period}</div>
      <div className="sub">Showing: {scopeLabel} · Filters: {filterText}</div>
      <div className="sub">{BASIS}</div>
    </div>
  );
  const small = { fontSize: 12, padding: "6px 10px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="panel no-print" style={{ padding: "12px 18px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search student, ID, receipt or invoice" aria-label="Search" style={{ ...sel, minWidth: 220, flex: "1 1 220px" }} />
        {methods.length > 1 && (
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Payment method" style={sel}>
            <option value="">All methods</option>
            {methods.map((m) => <option key={m} value={m}>{methodLabel(m)}</option>)}
          </select>
        )}
        {categories.length > 1 && (
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Fee category" style={sel}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
        )}
        {full && teachers.length > 0 && (
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} aria-label="Teacher" style={sel}>
            <option value="">All teachers and office</option>
            {teachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            <option value="office">Office income (no teacher)</option>
          </select>
        )}
        {anyFilter && (
          <button className="btn ghost" type="button" style={small} onClick={() => { setQ(""); setMethod(""); setCategory(""); setTeacher(""); }}>Clear filters</button>
        )}
      </div>

      <section className="panel" id="fc-summary" style={{ padding: 18 }}>
        {printHead("Monthly Fees Collection, summary")}
        <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
          <div className="ptitle">Summary for {monthLabel}</div>
          {anyFilter && <span className="sub">Filtered: {filterText}</span>}
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn ghost" type="button" style={small} onClick={excelSummary} disabled={!filtered.length && !refundsShown.length}>Excel</button>
          <button className="btn ghost" type="button" style={small} onClick={() => pdf("summary")} disabled={(!filtered.length && !refundsShown.length) || !!busy}>{busy === "summary" ? "Making PDF…" : "PDF"}</button>
          <PrintSectionButton target="fc-summary" label="Print summary" />
        </div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <Tile label="Total fees collected" value={taka(summary.total)} sub={full ? "All cash received this month" : "Your share of cash received this month"} />
          <Tile label="Total students paid" value={String(summary.students)} sub="Students with at least one payment" />
          <Tile label="Total transactions" value={String(summary.txns)} sub="Receipts, each counted once" />
          {refundsShown.length > 0 && <Tile label="Refunds given" value={"− " + taka(refundTotal)} sub={`${refundCount} ${refundCount === 1 ? "refund" : "refunds"}, deducted this month`} />}
          {refundsShown.length > 0 && <Tile label="Net collection" value={taka(r2(summary.total - refundTotal))} sub="Collected less refunds" />}
        </div>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: 16 }}>
          {full && (
            <div className="tblwrap">
              <table>
                <thead><tr><th>Where the money goes</th><th className="n">Amount</th></tr></thead>
                <tbody>
                  <tr><td>Teacher fees (tuition and mock)</td><td className="n mono">{taka(summary.teacherFees)}</td></tr>
                  <tr><td>Office income (admission and other)</td><td className="n mono">{taka(summary.officeIncome)}</td></tr>
                  {summary.advance !== 0 && <tr><td>Advance (not yet applied to an invoice)</td><td className="n mono">{taka(summary.advance)}</td></tr>}
                  <tr><td><b>Total collected</b></td><td className="n mono"><b>{taka(summary.total)}</b></td></tr>
                  {refundsShown.length > 0 && <tr><td>Refunds given this month</td><td className="n mono">− {taka(refundTotal)}</td></tr>}
                  {refundsShown.length > 0 && <tr><td><b>Net collection</b></td><td className="n mono"><b>{taka(r2(summary.total - refundTotal))}</b></td></tr>}
                </tbody>
              </table>
            </div>
          )}
          <div className="tblwrap">
            <table>
              <thead><tr><th>{full ? "By fee category" : "By subject"}</th><th className="n">Receipts</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {(full ? summary.byCategory : summary.bySubject).map((c) => (
                  <tr key={c.label}><td>{c.label}</td><td className="n mono">{c.txns}</td><td className="n mono">{taka(c.amount)}</td></tr>
                ))}
                {!filtered.length && <tr><td colSpan={3} className="sub">No payments.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="tblwrap">
            <table>
              <thead><tr><th>By payment method</th><th className="n">Receipts</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {summary.byMethod.map((c) => (
                  <tr key={c.label}><td>{c.label}</td><td className="n mono">{c.txns}</td><td className="n mono">{taka(c.amount)}</td></tr>
                ))}
                {!filtered.length && <tr><td colSpan={3} className="sub">No payments.</td></tr>}
              </tbody>
            </table>
          </div>
          {full && summary.byTeacher.length > 0 && (
            <div className="tblwrap">
              <table>
                <thead><tr><th>By teacher</th><th className="n">Receipts</th><th className="n">Amount</th></tr></thead>
                <tbody>
                  {summary.byTeacher.map((c) => (
                    <tr key={c.label}><td>{c.label}</td><td className="n mono">{c.txns}</td><td className="n mono">{taka(c.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="sub" style={{ marginTop: 12 }}>
          {BASIS}{" "}
          {full
            ? "A receipt that pays for several subjects or fees is split across them and still counted once in the total."
            : "Only the tuition and mock fees of your subjects are shown, using the items ticked when each payment was taken. Admission fees are office income and are not included."}
        </div>
      </section>

      {openGroup && (
        <section ref={panelRef} className="panel no-print" style={{ padding: 18, border: "1px solid var(--coral)", scrollMarginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
            <div className="ptitle">{openGroup.name} <span className="sub mono">{openGroup.reg}</span></div>
            <span className="sub">{openGroup.txns} {openGroup.txns === 1 ? "payment" : "payments"} in {monthLabel}, {taka(openGroup.total)}{full ? "" : " for your subjects"}</span>
            <div className="spacer" style={{ flex: 1 }} />
            {linkStudents && <a className="btn ghost" href={`/students/${openGroup.id}`} style={small}>Student page</a>}
            <button className="btn ghost" type="button" style={small} onClick={() => setOpen(null)}>Close</button>
          </div>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            {receipts(openGroup).map((lines) => {
              const p = lines[0];
              const sum = r2(lines.reduce((n, r) => n + r.amount, 0));
              return (
                <div key={p.payment_id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, background: "var(--tint)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b className="mono">{p.receipt_no}</b>
                    <span className="mono">{taka(full ? p.payment_amount : sum)}</span>
                  </div>
                  <div className="sub">{p.received_at ? fmtDateTime(p.received_at) : fmtDate(p.received_on)} · {methodLabel(p.method)}</div>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5 }}>
                    {lines.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span>
                          {r.item}
                          {feeMonth(r) && <span className="sub"> · {feeMonth(r)}</span>}
                          {r.invoice_no && (linkInvoices && r.invoice_id
                            ? <> · <a href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</a></>
                            : <span className="sub"> · {r.invoice_no}</span>)}
                        </span>
                        <span className="mono">{taka(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                  {!full && p.payment_amount !== sum && <div className="sub" style={{ marginTop: 6 }}>Only your subjects&apos; part of this receipt is shown.</div>}
                  {full && p.payment_note && <div className="sub" style={{ marginTop: 6 }}>Note: {p.payment_note}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel" id="fc-detail">
        {printHead("Monthly Fees Collection, transactions")}
        <div className="phead no-print" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="ptitle">Student-wise collection</div>
          <div className="sub">{summary.txns} {summary.txns === 1 ? "transaction" : "transactions"} · select a name to see that student&apos;s receipts</div>
          <div className="spacer" />
          <button className="btn ghost" type="button" style={small} onClick={excelDetail} disabled={!filtered.length && !refundsShown.length}>Excel</button>
          <button className="btn ghost" type="button" style={small} onClick={() => pdf("detail")} disabled={(!filtered.length && !refundsShown.length) || !!busy}>{busy === "detail" ? "Making PDF…" : "PDF"}</button>
          <PrintSectionButton target="fc-detail" label="Print details" />
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Student ID</th><th>Student name</th><th>Class / section</th><th>Payment date</th><th>Receipt no.</th>
                <th>Invoice no.</th><th>Fee category / subject</th><th>Fee month(s)</th><th>Method</th><th className="n">Amount</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.id}>
                  {g.rows.map((r, i) => {
                    const first = i === 0 || g.rows[i - 1].payment_id !== r.payment_id;
                    return (
                      <tr key={`${r.payment_id}-${r.invoice_line_id ?? "x"}-${i}`}>
                        <td className="mono">{first ? serial.get(r.payment_id) : ""}</td>
                        <td className="mono">{r.reg_no}</td>
                        <td><button type="button" style={linkBtn} onClick={() => setOpen(open === g.id ? null : g.id)}>{r.student_name}</button></td>
                        <td>{classSection(r) || "—"}</td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{first ? fmtDate(r.received_on) : ""}</td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>{first ? r.receipt_no : ""}</td>
                        <td className="mono" style={{ whiteSpace: "nowrap" }}>
                          {r.invoice_no ? (linkInvoices && r.invoice_id ? <a href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</a> : r.invoice_no) : "—"}
                        </td>
                        <td>
                          {r.item}
                          {full && r.teacher_name && <div className="sub">{r.teacher_name}</div>}
                          {full && (r.category === "admission" || r.category === "other") && <div className="sub">Office income</div>}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>{feeMonth(r) || "—"}</td>
                        <td>{first ? methodLabel(r.method) : ""}</td>
                        <td className="n mono">{taka(r.amount)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "var(--tint)" }}>
                    <td colSpan={10}>
                      <button type="button" style={linkBtn} onClick={() => setOpen(open === g.id ? null : g.id)}>Total for {g.name}</button>
                      <span className="sub"> · {g.txns} {g.txns === 1 ? "transaction" : "transactions"}</span>
                    </td>
                    <td className="n mono"><button type="button" style={{ ...linkBtn, fontFamily: "inherit" }} onClick={() => setOpen(open === g.id ? null : g.id)}>{taka(g.total)}</button></td>
                  </tr>
                </Fragment>
              ))}
              {!groups.length && (
                <tr><td colSpan={11} className="sub">{rows.length ? "No payments match these filters." : `No payments received in ${monthLabel}.`}</td></tr>
              )}
            </tbody>
            {groups.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={10}><b>Total fees collected</b> <span className="sub">· {summary.txns} transactions, {summary.students} students</span></td>
                  <td className="n mono"><b>{taka(summary.total)}</b></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {refundsShown.length > 0 && (
          <div style={{ padding: "16px 16px 4px" }}>
            <div className="ptitle" style={{ fontSize: 14 }}>Refunds given in {monthLabel}</div>
            <div className="sub" style={{ marginBottom: 8 }}>
              Deducted in this month, the month the money was given back{full ? ": subject and mock fees from the teacher, admission fees from office income" : " from your fees"}. The original payments stay in the months they were received.
            </div>
            <div className="tblwrap">
              <table>
                <thead>
                  <tr><th>Refund no.</th><th>Date</th><th>Student ID</th><th>Student name</th><th>Invoice no.</th><th>Fee refunded</th><th>Fee month(s)</th><th>Method</th><th>Reason</th><th className="n">Amount</th></tr>
                </thead>
                <tbody>
                  {refundsShown.map((r, i) => (
                    <tr key={`${r.refund_id}-${r.invoice_line_id}-${i}`}>
                      <td className="mono">{r.refund_no}</td>
                      <td className="mono" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.refunded_on)}</td>
                      <td className="mono">{r.reg_no}</td>
                      <td>{linkStudents ? <a href={`/students/${r.student_id}`}>{r.student_name}</a> : r.student_name}</td>
                      <td className="mono">{r.invoice_no ? (linkInvoices && r.invoice_id ? <a href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</a> : r.invoice_no) : "—"}</td>
                      <td>{r.item}{full && r.teacher_name && <div className="sub">{r.teacher_name}</div>}{full && (r.category === "admission" || r.category === "other") && <div className="sub">Office income</div>}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.billing_month ? monthName(r.billing_month) : "—"}</td>
                      <td>{methodLabel(r.method)}</td>
                      <td>{r.reason}</td>
                      <td className="n mono" style={{ color: "var(--crit)" }}>− {taka(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={9}><b>Total refunds</b></td><td className="n mono"><b>− {taka(refundTotal)}</b></td></tr>
                  <tr><td colSpan={9}><b>Net collection</b> <span className="sub">· collected {taka(summary.total)} less refunds</span></td><td className="n mono"><b>{taka(r2(summary.total - refundTotal))}</b></td></tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
        {voids.length > 0 && (
          <div style={{ padding: "16px 16px 4px" }}>
            <div className="ptitle" style={{ fontSize: 14 }}>Voided receipts</div>
            <div className="sub" style={{ marginBottom: 8 }}>
              Received or voided in {monthLabel}. Shown for transparency and not counted in any total; the original records are kept unchanged.
            </div>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Receipt no.</th><th>Student ID</th><th>Student name</th><th>Received on</th><th>Voided on</th><th>Method</th><th className="n">Amount</th><th>Reason</th></tr></thead>
                <tbody>
                  {voids.map((v) => (
                    <tr key={v.payment_id}>
                      <td className="mono">{v.receipt_no}</td>
                      <td className="mono">{v.reg_no}</td>
                      <td>{v.student_name}</td>
                      <td className="mono">{fmtDate(v.received_on)}</td>
                      <td className="mono">{fmtDate(v.voided_on)}</td>
                      <td>{methodLabel(v.method)}</td>
                      <td className="n mono" style={{ textDecoration: "line-through" }}>{taka(v.amount)}</td>
                      <td>{v.void_reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="sub" style={{ padding: "12px 16px 16px" }}>
          Each receipt has one number (#). A receipt that paid for several {full ? "fees" : "of your subjects"} shows one line per item; the lines add up to what was paid and the receipt is counted once.
        </div>
      </section>
    </div>
  );
}
