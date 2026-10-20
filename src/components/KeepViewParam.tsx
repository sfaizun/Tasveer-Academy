"use client";
import { useSearchParams } from "next/navigation";

/** Inside a GET filter form: keeps "?view=academy" so filtering doesn't switch a teacher back to their own view. */
export default function KeepViewParam() {
  const view = useSearchParams().get("view");
  return view === "academy" ? <input type="hidden" name="view" value="academy" /> : null;
}
