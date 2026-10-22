import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { dhakaTodayISO, fmtDate } from "@/lib/format";
import { requirePage } from "@/lib/require-page";
import { viewReadOnly } from "@/lib/access";
import { MyDetailsForm, MyGuardianForm, type MyGuardian } from "./Forms";

export const dynamic = "force-dynamic";

/** A student's own profile: Student ID, admission date and programme (set by the office), and
 * their details and guardians, which they can update themselves. */
export default async function MyProfilePage() {
  await requirePage("my_profile");
  const { me } = await getViewer();
  if (!me) redirect("/login");
  if (me.role !== "student") redirect("/dashboard");
  const supabase = await createClient();
  const { data: st } = await supabase
    .from("student")
    .select("id, reg_no, previous_reg_no, full_name, gender, date_of_birth, nationality, phone, email, school_name, address, admitted_on, status, programme(name), class_level(name), guardian(id, full_name, relation, phone, email, address, is_primary)")
    .eq("app_user_id", me.id)
    .maybeSingle();
  const s = st as any;
  const guardians = ((s?.guardian ?? []) as MyGuardian[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.full_name.localeCompare(b.full_name));
  const readOnly = !!me.impersonation || viewReadOnly(me);

  return (
    <>
      <header className="top">
        <h1>My profile</h1>
        <div className="sub">{s?.full_name ?? ""}</div>
        <div className="spacer" />
        <ThemeToggle />
      </header>
      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {!s ? (
          <div className="panel" style={{ padding: 18 }}><div className="sub">Your student record isn&apos;t linked to this login yet. Please contact the office.</div></div>
        ) : (
          <>
            <div className="panel">
              <div className="phead"><div className="ptitle">Set by the office</div></div>
              <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", padding: "14px 18px" }}>
                <div><div className="lbl">Student ID</div><div className="mono">{s.reg_no}</div></div>
                <div><div className="lbl">Admitted on</div><div className="mono">{fmtDate(s.admitted_on)}</div></div>
                <div><div className="lbl">Programme</div><div>{s.class_level?.name ?? s.programme?.name ?? "-"}</div></div>
                {s.previous_reg_no && <div><div className="lbl">Previous reg. no.</div><div className="mono">{s.previous_reg_no}</div></div>}
              </div>
              <div className="sub" style={{ padding: "0 18px 14px" }}>To change any of these, contact the office.</div>
            </div>

            <div className="panel">
              <div className="phead"><div className="ptitle">My details</div></div>
              <div style={{ padding: "14px 18px" }}>
                {readOnly ? <div className="sub">View only.</div> : <MyDetailsForm d={s} today={dhakaTodayISO()} />}
              </div>
            </div>

            {guardians.map((g) => (
              <div className="panel" key={g.id}>
                <div className="phead">
                  <div className="ptitle">Guardian{g.is_primary ? " (primary)" : ""}</div>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {readOnly ? <div>{g.full_name} · {g.phone ?? "-"}</div> : <MyGuardianForm g={g} />}
                </div>
              </div>
            ))}
            {guardians.length === 0 && (
              <div className="panel" style={{ padding: 18 }}><div className="sub">No guardian on record. Please ask the office to add one.</div></div>
            )}
          </>
        )}
      </div>
    </>
  );
}
