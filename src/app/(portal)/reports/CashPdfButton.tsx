"use client";

import { useState } from "react";
import { fmtDate, fmtDateTime } from "@/lib/format";

export type CashPdfRow = { receipt_no: string; student: string; reg_no: string; method: string; amount: number; note: string };

const tk = (n: number) => "Tk " + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Saves the daily cash collection for one date as a PDF: totals by payment method, then every
 * receipt received that day with a grand total. */
export default function CashPdfButton({ date, rows, methods }: {
  date: string;
  rows: CashPdfRow[];
  methods: [string, number][];
}) {
  const [busy, setBusy] = useState(false);

  async function save(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const total = rows.reduce((s, r) => s + r.amount, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("Tasveer Academy: Daily Cash Collection", 40, 46);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Date: ${fmtDate(date)}`, 40, 64);
      doc.text(`Receipts: ${rows.length} · Total collected: ${tk(total)}`, 40, 77);
      doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}`, 40, 90);
      const coral: [number, number, number] = [210, 74, 61];
      const base = { theme: "grid" as const, styles: { fontSize: 8.5, cellPadding: 4 }, headStyles: { fillColor: coral, textColor: 255 }, margin: { left: 40, right: 40 } };
      const bold = (cells: string[]) => cells.map((c) => ({ content: c, styles: { fontStyle: "bold" as const, fillColor: [247, 241, 236] as [number, number, number] } }));
      const after = () => (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100;

      autoTable(doc, {
        ...base, startY: 104, tableWidth: 260,
        head: [["Method", "Amount"]],
        body: [...methods.map(([m, a]) => [m, tk(a)]), bold(["Total", tk(total)])],
        columnStyles: { 1: { halign: "right" } },
      });

      autoTable(doc, {
        ...base, startY: after() + 18,
        head: [["#", "Receipt no.", "Student name", "Student ID", "Method", "Amount", "Note"]],
        body: rows.length
          ? [
              ...rows.map((r, i) => [String(i + 1), r.receipt_no, r.student, r.reg_no, r.method, tk(r.amount), r.note]),
              bold(["", "", `Total (${rows.length} receipt${rows.length === 1 ? "" : "s"})`, "", "", tk(total), ""]),
            ]
          : [[{ content: "No payments received on this date.", colSpan: 7 }]],
        columnStyles: { 0: { cellWidth: 22 }, 5: { halign: "right" } },
      });

      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Daily cash collection, ${fmtDate(date)} · Page ${p} of ${pages}`, W - 40, H - 20, { align: "right" });
      }
      doc.save(`cash-collection-${date}.pdf`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn ghost no-print" style={{ fontSize: 12, padding: "6px 10px" }} onClick={save} disabled={busy}>
      {busy ? "Saving…" : "PDF"}
    </button>
  );
}
