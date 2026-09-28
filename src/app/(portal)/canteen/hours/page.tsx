import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { requireCanteenAccess } from "../guard";
import HoursEditor from "./HoursEditor";
import { canteenStatus, dhakaNow, statusLabel, type CanteenClosureRow, type CanteenHoursRow } from "@/lib/canteen";

export const dynamic = "force-dynamic";

export default async function CanteenHoursPage() {
  await requireCanteenAccess();
  const supabase = await createClient();

  const [{ data: hours }, { data: closures }] = await Promise.all([
    supabase.from("canteen_hours").select("weekday, is_open, opens_at, closes_at").order("weekday"),
    supabase.from("canteen_closure").select("id, date_from, date_to, reason").order("date_from", { ascending: false }),
  ]);

  const h = (hours ?? []) as CanteenHoursRow[];
  const c = (closures ?? []) as CanteenClosureRow[];
  const status = statusLabel(canteenStatus(h, c));

  return (
    <>
      <header className="top">
        <h1>Opening hours</h1>
        <span className={`st ${status.cls}`}><span className="dot" />{status.text}</span>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content">
        <HoursEditor hours={h} closures={[...c].sort((a, b) => a.date_from.localeCompare(b.date_from))} today={dhakaNow().date} />
      </div>
    </>
  );
}
