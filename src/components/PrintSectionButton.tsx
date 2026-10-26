"use client";

/** Prints one section of a page (the element with id `target`) instead of the whole page. The
 * section is opened if it is collapsed, everything else on the page is hidden while printing, and
 * lists inside it that open row by row (for example the students of each subject) print in full. */
export default function PrintSectionButton({ target, label = "Print" }: { target: string; label?: string }) {
  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = document.getElementById(target);
    if (!el) { window.print(); return; }
    const wasOpen = el instanceof HTMLDetailsElement ? el.open : true;
    if (el instanceof HTMLDetailsElement) el.open = true;
    el.classList.add("print-target");
    document.documentElement.setAttribute("data-print-section", target);
    const done = () => {
      el.classList.remove("print-target");
      document.documentElement.removeAttribute("data-print-section");
      if (el instanceof HTMLDetailsElement) el.open = wasOpen;
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
  }
  return (
    <button className="btn ghost no-print" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={onClick}>
      {label}
    </button>
  );
}
