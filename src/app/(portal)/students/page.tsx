import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import StudentsTable, { type StudentRow } from "./StudentsTable";
import { requirePage } from "@/lib/require-page";
import { getViewer } from "@/lib/supabase/viewer";
import { accessOf, canSeeFees } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  await requirePage("students");
  const { me } = await getViewer();
  const showFees = canSeeFees(accessOf(me));
  const supabase = await createClient();

  const { data } = await supabase
    .from("student")
    .select(
      "id, reg_no, full_name, phone, email, status, admitted_on, created_at, enrolment_type, programme(name), class_level(name), invoice(balance, status)"
    )
    .order("created_at", { ascending: false });

  const students = (data ?? []) as unknown as StudentRow[];

  return (
    <>
      <header className="top">
        <h1>Students</h1>
        <div className="sub">Created once an admission application is approved</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <StudentsTable students={students} showFees={showFees} />
      </div>
    </>
  );
}
