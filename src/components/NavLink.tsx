"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} className={active ? "nav on" : "nav"} aria-current={active ? "page" : undefined}>
      <span>{children}</span>
    </Link>
  );
}
