import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka, fmtDate } from "@/lib/format";
import PaymentForm from "./PaymentForm";
import PaymentsList, { type PaymentRow } from "./PaymentsList";
import StatusForm from "./StatusForm";
import EnrolmentsPanel from "./EnrolmentsPanel";
import InvoicesList from "./InvoicesList";

export const dynamic = "force-dynamic";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: me }, { data: student }, { data: guardians }, { data: siblings }, { data: enrolments }, { data: invoices }, { data: payments }] =
    await Promise.all([
      supabase.from("app_user").select("is_owner, role").eq("auth_id", user?.id ?? "").maybeSingle(),
      supabase
        .from("student")
        .select(
          "id, reg_no, previous_reg_no, full_name, gender, nationality, phone, email, address, school_name, status, admitted_on, programme_id, enrolment_type, programme(name, code), class_level(name)"
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("guardian").select("full_name, relation, phone, email, address, is_primary").eq("student_id", id),
      supabase.from("sibling").select("full_name, class_name, school_name").eq("student_id", id),
      supabase
        .from("enrolment")
        .select("id, level, from_month, to_month, rate_applied, status, subject(name), teacher(full_name)")
        .eq("student_id", id)
        .order("from_month", { ascending: false }),
      supabase
        .from("invoice")
        .select("id, invoice_no, billing_month, due_on, overdue_on, gross, discount, net, paid, balance, status, invoice_line(id, type, description, rate, quantity, amount)")
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

  const [{ data: subjects }, { data: teachers }, { data: teacherSubjects }] = isSubjectBased
    ? await Promise.all([
        supabase
          .from("subject")
          .select("id, name, level, programme(code, name)")
          .eq("programme_id", s.programme_id)
          .eq("active", true),
        supabase.from("teacher").select("id, full_name").eq("active", true).order("full_name"),
        supabase.from("teacher_subject").select("teacher_id, subject_id").eq("active", true),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

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
    .map((i: any) => ({ id: i.id, invoice_no: i.invoice_no, billing_month: i.billing_month, balance: Number(i.balance) }));

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
        <ThemeToggle />
      </header>

      <div className="content" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
          </div>
          {isAdmin && (
            <div style={{ padding: "0 18px 18px" }}>
              <div className="lbl" style={{ marginBottom: 8 }}>Change status</div>
              <StatusForm studentId={id} status={s.status} />
            </div>
          )}
        </div>

        {(guardians ?? []).length > 0 && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Guardian</div></div>
            <div className="tblwrap">
              <table>
                <thead><tr><th>Name</th><th>Relation</th><th>Phone</th><th>Email</th></tr></thead>
                <tbody>
                  {(guardians ?? []).map((g: any, i: number) => (
                    <tr key={i}>
                      <td><b>{g.full_name}</b>{g.is_primary && <span className="sub"> (primary)</span>}</td>
                      <td className="sub">{g.relation ?? "—"}</td>
                      <td className="sub">{g.phone ?? "—"}</td>
                      <td className="sub">{g.email ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
            enrolments={(enrolments ?? []) as any}
            subjects={(subjects ?? []) as any}
            teachers={(teachers ?? []) as any}
            teacherSubjects={(teacherSubjects ?? []) as any}
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
    </>
  );
}
