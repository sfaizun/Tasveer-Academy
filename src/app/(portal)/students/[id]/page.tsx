import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/supabase/viewer";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, fmtDate } from "@/lib/format";
import PaymentForm, { type DiscountableFee } from "./PaymentForm";
import PaymentsList, { type PaymentRow } from "./PaymentsList";
import StatusForm from "./StatusForm";
import EditStudentForm from "./EditStudentForm";
import EnrolmentsPanel from "./EnrolmentsPanel";
import GuardiansPanel from "./GuardiansPanel";
import InvoicesList from "./InvoicesList";
import AdmissionFeePanel from "./AdmissionFeePanel";
import StudentRoutine, { type RoutineRow } from "./StudentRoutine";

export const dynamic = "force-dynamic";

// The subject fees on an open invoice (tuition, or the mock fee for a mock-only student),
// each with what is left after discounts already on it. A discount given with a payment is
// split equally across these; the admission fee is never included (it has its own panel).
// Mirrors fn_record_payment's own matching rules so the preview matches what gets saved.
function discountableFees(lines: any[]): DiscountableFee[] {
  const discounts = lines.filter((l) => l.type === "discount");
  const already = (match: (d: any) => boolean) =>
    discounts.filter(match).reduce((s, d) => s + Math.abs(Number(d.amount)), 0);

  return lines
    .filter((l) => l.type === "tuition" || l.type === "mock")
    .map((l) => {
      let used = 0;
      if (l.enrolment_id) {
        used = already((d) => d.enrolment_id === l.enrolment_id);
      } else if (l.type === "mock") {
        used = already((d) => !d.enrolment_id && String(d.description).startsWith("Mock exam fee discount"));
      } else {
        used = already((d) => !d.enrolment_id && String(d.description).startsWith("Monthly fee discount"));
      }
      return { line_id: l.id as string, label: l.description as string, left: Math.max(Number(l.amount) - used, 0) };
    });
}

function StatusChip({ status, map }: { status: string; map: Record<string, { cls: string; label: string }> }) {
  const m = map[status] ?? { cls: "due", label: status };
  return (
    <span className={`st ${m.cls}`}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

const studentStatusMap: Record<string, { cls: string; label: string }> = {
  applicant: { cls: "due", label: "Applicant" },
  active: { cls: "paid", label: "Active" },
  on_hold: { cls: "part", label: "On hold" },
  dropped: { cls: "over", label: "Dropped" },
  alumni: { cls: "past", label: "Alumni" },
};

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { me } = await getViewer();

  const [{ data: student }, { data: guardians }, { data: siblings }, { data: enrolments }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase
        .from("student")
        .select(
          "id, reg_no, previous_reg_no, full_name, gender, nationality, phone, email, address, school_name, status, admitted_on, programme_id, class_level_id, enrolment_type, programme(name, code), class_level(name)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("guardian").select("id, full_name, relation, phone, email, address, is_primary").eq("student_id", id),
      supabase.from("sibling").select("full_name, class_name, school_name").eq("student_id", id),
      supabase
        .from("enrolment")
        .select(
          "id, level, from_month, to_month, rate_applied, status, subject(id, name), teacher(id, full_name), class_group_id, class_group(batch_name), discount_pct, discount_amt, discount_reason"
        )
        .eq("student_id", id)
        .order("from_month", { ascending: false }),
      supabase
        .from("invoice")
        .select("id, invoice_no, billing_month, due_on, overdue_on, gross, discount, net, paid, balance, status, invoice_line(id, type, description, rate, quantity, amount, enrolment_id)")
        .eq("student_id", id)
        .order("billing_month", { ascending: false }),
      supabase
        .from("payment")
        .select("id, receipt_no, amount, method, received_on, status, note, void_reason, payment_allocation(invoice_id, amount)")
        .eq("student_id", id)
        .order("received_at", { ascending: false }),
    ]);

  if (!student) notFound();

  const isOwner = !!me?.is_owner;
  const isAdmin = me?.role === "admin";
  const s: any = student;
  const isSubjectBased = s.programme?.code === "o_level" || s.programme?.code === "a_level";
  const isMockOnly = s.enrolment_type === "mock_only";

  const [{ data: subjects }, { data: teachers }, { data: teacherSubjects }, { data: classGroupsData }] = isSubjectBased
    ? await Promise.all([
        supabase
          .from("subject")
          .select("id, name, level, programme(code, name)")
          .eq("programme_id", s.programme_id)
          .eq("active", true),
        supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
        supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
        supabase.from("class_group").select("subject_id, teacher_id, batch_name"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const { data: mockSubjects } = isMockOnly
    ? await supabase
        .from("mock_registration")
        .select("subject_id, subject(name, level)")
        .eq("student_id", id)
    : { data: [] };

  const outstanding = (invoices ?? [])
    .filter((i: any) => i.status !== "void" && i.status !== "waived")
    .reduce((sum: number, i: any) => sum + Number(i.balance || 0), 0);

  const openInvoices = (invoices ?? [])
    .filter((i: any) => (i.status === "unpaid" || i.status === "partly_paid") && Number(i.balance) > 0)
    .map((i: any) => ({
      id: i.id,
      invoice_no: i.invoice_no,
      billing_month: i.billing_month,
      balance: Number(i.balance),
      fees: discountableFees(i.invoice_line ?? []),
    }));

  // Flattened for EnrolmentsPanel, which expects batch_name directly on the enrolment
  // rather than nested under class_group.
  const mappedEnrolments = (enrolments ?? []).map((e: any) => ({
    id: e.id,
    level: e.level,
    from_month: e.from_month,
    to_month: e.to_month,
    rate_applied: e.rate_applied,
    status: e.status,
    subject: e.subject,
    teacher: e.teacher,
    batch_name: e.class_group?.batch_name ?? null,
    discount_pct: e.discount_pct,
    discount_amt: e.discount_amt,
    discount_reason: e.discount_reason,
  }));

  // This student's actual weekly routine, built the same way as the main Class Schedule
  // page: class_slot rows scoped to whichever class_groups their active subjects put them
  // in (O/A Level), or their class_level (Junior/mock-only has no ongoing class at all).
  const activeClassGroupIds = (enrolments ?? [])
    .filter((e: any) => e.status === "active" && e.class_group_id)
    .map((e: any) => e.class_group_id as string);

  let routineRows: RoutineRow[] = [];
  if (activeClassGroupIds.length > 0 || s.class_level_id) {
    const orParts: string[] = [];
    if (activeClassGroupIds.length > 0) orParts.push(`class_group_id.in.(${activeClassGroupIds.join(",")})`);
    if (s.class_level_id) orParts.push(`class_level_id.eq.${s.class_level_id}`);
    const { data: slots } = await supabase
      .from("class_slot")
      .select(
        `id, weekday, start_time, end_time, room, class_group_id, class_level_id,
         class_group(batch_name, subject(name, level), teacher(full_name)),
         class_level(name, programme(name)),
         teacher:teacher_id(full_name)`
      )
      .or(orParts.join(","))
      .order("weekday")
      .order("start_time");

    routineRows = ((slots ?? []) as any[]).map((r) => {
      if (r.class_group) {
        const sub = r.class_group.subject;
        const name = sub?.name ?? "Subject";
        const level = sub?.level ? ` (${String(sub.level).toUpperCase()})` : "";
        return {
          id: r.id,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          room: r.room,
          title: `${name}${level} — Batch ${r.class_group.batch_name}`,
          teacherName: r.class_group.teacher?.full_name ?? "—",
        };
      }
      if (r.class_level) {
        const prog = r.class_level.programme?.name ?? "";
        return {
          id: r.id,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          room: r.room,
          title: `${r.class_level.name}${prog ? ` (${prog})` : ""}`,
          teacherName: r.teacher?.full_name ?? "—",
        };
      }
      return { id: r.id, weekday: r.weekday, start_time: r.start_time, end_time: r.end_time, room: r.room, title: "—", teacherName: "—" };
    });
  }

  return (
    <>
      <header className="top">
        <h1>{s.full_name}</h1>
        <div className="sub" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {s.reg_no} · {s.programme?.name}
          {s.class_level?.name ? ` — ${s.class_level.name}` : ""}
          {isMockOnly && (
            <span
              className="chip"
              style={{ fontSize: 11, padding: "3px 8px", color: "var(--blue)", borderColor: "var(--blue-soft)", background: "var(--blue-soft)" }}
            >
              Mock exam candidate
            </span>
          )}
        </div>
        <div className="spacer" />
        <span className="no-print"><ThemeToggle /></span>
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="panel">
          <div className="phead">
            <div className="ptitle">Student</div>
            <div className="spacer" />
            <StatusChip status={s.status} map={studentStatusMap} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, padding: 18 }}>
            <div><div className="lbl">Reg. no.</div><div className="mono">{s.reg_no}</div></div>
            {s.previous_reg_no && <div><div className="lbl">Previous reg. no.</div><div className="mono">{s.previous_reg_no}</div></div>}
            <div><div className="lbl">Gender</div><div>{s.gender ?? "—"}</div></div>
            <div><div className="lbl">Nationality</div><div>{s.nationality ?? "—"}</div></div>
            <div><div className="lbl">WhatsApp / mobile</div><div>{s.phone ?? "—"}</div></div>
            <div><div className="lbl">Email</div><div>{s.email ?? "—"}</div></div>
            <div><div className="lbl">School</div><div>{s.school_name ?? "—"}</div></div>
            <div><div className="lbl">Admitted on</div><div className="mono">{fmtDate(s.admitted_on)}</div></div>
            <div><div className="lbl">Address</div><div>{s.address ?? "—"}</div></div>
          </div>
          {isAdmin && (
            <div style={{ padding: "0 18px 18px" }}>
              <div className="lbl" style={{ marginBottom: 8 }}>Edit student</div>
              <EditStudentForm
                studentId={id}
                details={{
                  full_name: s.full_name,
                  previous_reg_no: s.previous_reg_no,
                  gender: s.gender,
                  nationality: s.nationality,
                  phone: s.phone,
                  email: s.email,
                  address: s.address,
                  school_name: s.school_name,
                  admitted_on: s.admitted_on,
                }}
              />
            </div>
          )}
          {isAdmin && (
            <div style={{ padding: "0 18px 18px" }}>
              <div className="lbl" style={{ marginBottom: 8 }}>Change status</div>
              <StatusForm studentId={id} status={s.status} />
            </div>
          )}
        </div>

        <GuardiansPanel studentId={id} guardians={(guardians ?? []) as any} canEdit={isAdmin} />

        {(siblings ?? []).length > 0 && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Siblings</div></div>
            <div style={{ padding: 18 }}>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5 }}>
                {(siblings ?? []).map((sib: any, i: number) => (
                  <li key={i}>{sib.full_name}{sib.class_name ? ` — ${sib.class_name}` : ""}{sib.school_name ? `, ${sib.school_name}` : ""}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {isMockOnly && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">Mock exam subjects</div>
              <div className="sub">Sitting mocks only — no ongoing class, teacher or monthly billing</div>
            </div>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Subject</th></tr></thead>
                <tbody>
                  {(mockSubjects ?? []).map((r: any, i: number) => (
                    <tr key={i}>
                      <td>{r.subject?.name}{r.subject?.level ? ` (${String(r.subject.level).toUpperCase()})` : ""}</td>
                    </tr>
                  ))}
                  {(mockSubjects ?? []).length === 0 && (
                    <tr><td className="sub">No mock subjects on record.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isSubjectBased ? (
          <EnrolmentsPanel
            studentId={id}
            enrolments={mappedEnrolments}
            subjects={(subjects ?? []) as any}
            teachers={(teachers ?? []) as any}
            teacherSubjects={(teacherSubjects ?? []) as any}
            classGroups={(classGroupsData ?? []) as any}
            canEdit={isAdmin}
          />
        ) : (enrolments ?? []).length > 0 ? (
          <div className="panel">
            <div className="phead"><div className="ptitle">Enrolments</div></div>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Subject</th><th>Teacher</th><th>From</th><th>To</th><th className="n">Rate</th><th className="n">Status</th></tr></thead>
                <tbody>
                  {(enrolments ?? []).map((e: any) => (
                    <tr key={e.id}>
                      <td>{e.subject?.name}{e.level ? ` (${String(e.level).toUpperCase()})` : ""}</td>
                      <td className="sub">{e.teacher?.full_name}</td>
                      <td className="mono sub">{fmtDate(e.from_month)}</td>
                      <td className="mono sub">{e.to_month ? fmtDate(e.to_month) : "—"}</td>
                      <td className="n mono">{taka(e.rate_applied)}</td>
                      <td className="n sub">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {isAdmin && <AdmissionFeePanel studentId={id} invoices={(invoices ?? []) as any} />}

        <InvoicesList invoices={(invoices ?? []) as any} outstanding={outstanding} />

        {isAdmin && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Record a payment</div></div>
            <div style={{ padding: 18 }}>
              <PaymentForm studentId={id} outstanding={outstanding} openInvoices={openInvoices} />
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead"><div className="ptitle">Payment history</div></div>
          <PaymentsList
            studentId={id}
            payments={(payments ?? []) as PaymentRow[]}
            canEdit={isAdmin}
            canVoid={isOwner}
          />
        </div>
      </div>

      {isAdmin && <StudentRoutine rows={routineRows} />}
      </div>
    </>
  );
}
