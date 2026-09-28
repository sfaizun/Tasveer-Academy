"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  // `exact` for a section home (e.g. /canteen) that sits above its own sub-pages in the menu.
  const active = path === href || (!exact && path.startsWith(href + "/"));
  return (
    <Link href={href} className={active ? "nav on" : "nav"} aria-current={active ? "page" : undefined}>
      <span>{children}</span>
    </Link>
  );
}
