"use client";
import { useEffect } from "react";

/**
 * Phone layout for data tables. On narrow screens globals.css turns every table inside a
 * `.tblwrap` into a stack of cards (one card per row, one "Label  value" line per cell)
 * instead of a wide table you have to scroll sideways. The labels come from each table's
 * own column headings: this component copies them onto the cells as `data-label`, and keeps
 * doing so as pages add rows, open an invoice or switch filters.
 *
 * It only sets data attributes (never class names or children), so React's own updates are
 * left alone. A table can opt out with `keep-table` on it or its `.tblwrap` (e.g. the access
 * matrix, which is a checkbox grid and reads best as a grid).
 */
function labelTables(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>(".tblwrap table").forEach((table) => {
    if (table.classList.contains("keep-table") || table.closest(".keep-table")) {
      if (table.hasAttribute("data-mt")) table.removeAttribute("data-mt");
      return;
    }
    const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
    const labels: string[] = [];
    if (headRow) {
      for (const th of Array.from(headRow.cells)) {
        const text = (th.textContent ?? "").replace(/\s+/g, " ").trim();
        for (let i = 0; i < (th.colSpan || 1); i++) labels.push(text);
      }
    }
    if (table.getAttribute("data-mt") !== "1") table.setAttribute("data-mt", "1");
    const bodies = [...Array.from(table.tBodies), ...(table.tFoot ? [table.tFoot] : [])];
    for (const body of bodies) {
      for (const row of Array.from(body.rows)) {
        let col = 0;
        for (const cell of Array.from(row.cells)) {
          const span = cell.colSpan || 1;
          const label = span === 1 ? labels[col] ?? "" : "";
          if (cell.getAttribute("data-label") !== label) cell.setAttribute("data-label", label);
          col += span;
        }
      }
    }
  });
}

export default function MobileTables() {
  useEffect(() => {
    let queued = false;
    const run = () => {
      queued = false;
      labelTables(document);
    };
    run();
    const obs = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(run);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
