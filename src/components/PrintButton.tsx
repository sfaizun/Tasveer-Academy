"use client";

/** A plain window.print() trigger — the same "use client" wrapper that roster/ScheduleView.tsx
 * and students/[id]/StudentRoutine.tsx each hand-rolled locally, pulled out here so a new
 * printable page (like /invoices) doesn't need its own client component just for one button. */
export default function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      className="btn no-print"
      type="button"
      style={{ fontSize: 12, padding: "6px 10px" }}
      onClick={() => window.print()}
    >
      {label}
    </button>
  );
}
