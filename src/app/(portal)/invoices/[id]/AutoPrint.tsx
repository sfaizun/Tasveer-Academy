"use client";
import { useEffect } from "react";

/** Opens the print dialog once the invoice has rendered (used when ?print=1). */
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
