import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { requireCanteenAccess } from "../guard";
import RequestsManager, { type RequestRow } from "./RequestsManager";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;

export default async function RequestsPage() {
  await requireCanteenAccess();
  const supabase = await createClient();

  const [{ data: requests }, { data: asks }, { data: items }] = await Promise.all([
    supabase.from("canteen_request").select("id, name, status, note, item_id, created_at, updated_at").order("updated_at", { ascending: false }),
    supabase.from("canteen_request_ask").select("kind, request_id, item_id, who, asked_at"),
    supabase.from("canteen_item").select("id, name, archived").order("name"),
  ]);

  const now = Date.now();
  const itemName = new Map((items ?? []).map((i: any) => [i.id, i.name as string]));
  const stats = new Map<string, { total: number; d7: number; d30: number; first: string | null; last: string | null; student: number; teacher: number }>();
  const soldOut = new Map<string, number>();

  for (const a of (asks ?? []) as any[]) {
    const age = now - new Date(a.asked_at).getTime();
    if (a.kind === "sold_out") {
      if (age <= 7 * DAY && a.item_id) soldOut.set(a.item_id, (soldOut.get(a.item_id) ?? 0) + 1);
      continue;
    }
    const s = stats.get(a.request_id) ?? { total: 0, d7: 0, d30: 0, first: null, last: null, student: 0, teacher: 0 };
    s.total += 1;
    if (age <= 7 * DAY) s.d7 += 1;
    if (age <= 30 * DAY) s.d30 += 1;
    if (!s.first || a.asked_at < s.first) s.first = a.asked_at;
    if (!s.last || a.asked_at > s.last) s.last = a.asked_at;
    if (a.who === "student") s.student += 1;
    if (a.who === "teacher") s.teacher += 1;
    stats.set(a.request_id, s);
  }

  const rows: RequestRow[] = (requests ?? []).map((r: any) => {
    const s = stats.get(r.id);
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      note: r.note,
      item_id: r.item_id,
      item_name: r.item_id ? itemName.get(r.item_id) ?? null : null,
      total: s?.total ?? 0,
      d7: s?.d7 ?? 0,
      d30: s?.d30 ?? 0,
      first: s?.first ?? r.created_at,
      last: s?.last ?? null,
      student: s?.student ?? 0,
      teacher: s?.teacher ?? 0,
    };
  });
  // Most wanted first within the list: recent demand, then all-time.
  rows.sort((a, b) => b.d30 - a.d30 || b.total - a.total || a.name.localeCompare(b.name));

  const soldOutList = [...soldOut.entries()]
    .map(([id, n]) => ({ name: itemName.get(id) ?? "Item", n }))
    .sort((a, b) => b.n - a.n);

  return (
    <>
      <header className="top">
        <h1>Requests</h1>
        <span className="sub">What customers asked for that we don&apos;t have</span>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content">
        <RequestsManager
          rows={rows}
          items={(items ?? []).filter((i: any) => !i.archived).map((i: any) => ({ id: i.id, name: i.name }))}
          soldOut={soldOutList}
        />
      </div>
    </>
  );
}
