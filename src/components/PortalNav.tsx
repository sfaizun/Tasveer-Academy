"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Wraps the portal sidebar so it also works on phone-width screens. On desktop this
 * renders exactly what it always did — a plain `<nav className="side">`, always visible.
 * At the mobile breakpoint (see globals.css, ≤820px) the sidebar becomes an off-canvas
 * drawer: hidden by default, opened with the hamburger button rendered here, closed by
 * tapping the backdrop or by navigating (the `usePathname` effect below), and closed with
 * a fade-free instant collapse if the viewport is resized back up past the breakpoint.
 *
 * The button and backdrop are inert (`display:none`, not just invisible) above the
 * breakpoint via CSS, so there's no way to trigger this on desktop even by keyboard.
 */
export default function PortalNav({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        className={`menu-btn${open ? " open" : ""}`}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <nav className={`side${open ? " open" : ""}`}>{children}</nav>
    </>
  );
}
