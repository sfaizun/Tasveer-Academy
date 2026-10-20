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
export default function PortalNav({ children, home = "/dashboard", bar }: { children: React.ReactNode; home?: string; bar?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock the page behind the open drawer so scrolling the menu doesn't scroll the page.
  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  return (
    <>
      {/* Phone app bar (hidden on desktop): stays at the top while the page scrolls. */}
      <div className="mbar">
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
        <a href={home} className="mbar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" width={26} height={26} />
          <span className="mbar-name">Tasveer Academy</span>
        </a>
        {bar}
      </div>
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <nav className={`side${open ? " open" : ""}`}>{children}</nav>
    </>
  );
}
