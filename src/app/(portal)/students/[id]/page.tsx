import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { taka } from "@/lib/format";
import PaymentForm from "./PaymentForm";
import PaymentsList, { type PaymentRow } from "./PaymentsList";
import StatusForm from "./StatusForm";

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

const invoiceStatusMap: Record<string, { cls: string; label: string }> = {
  draft: { cls: "due", label: "Draft" },
  unpaid: { cls: "due", label: "Unpaid" },
  partly_paid: { cls: "part", label: "Partly paid" },
  paid: { cls: "paid", label: "Paid" },
  waived: { cls: "past", label: "Waived" },
  void: { cls: "over", label: "Void" },
};

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
          "id, reg_no, previous_reg_no, full_name, gender, nationality, phone, email, address, school_name, status, admitted_on, programme(name, code), class_level(name)"
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

  const outstanding = (invoices ?? [])
    .filter((i: any) => i.status !== "void" && i.status !== "waived")
    .reduce((sum: number, i: any) => sum + Number(i.balance || 0), 0);

  const s: any = student;

  return (
    <>
      <header className="top">
        <h1>{s.full_name}</h1>
        <div className="sub">
          {s.reg_no} · {s.programme?.name}
          {s.class_level?.name ? ` — ${s.class_level.name}` : ""}
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
            <div><div className="lbl">Admitted on</div><div className="mono">{s.admitted_on ?? "—"}</div></div>
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

        {(enrolments ?? []).length > 0 && (
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
                      <td className="mono sub">{e.from_month}</td>
                      <td className="mono sub">{e.to_month ?? "—"}</td>
                      <td className="n mono">{taka(e.rate_applied)}</td>
                      <td className="n sub">{e.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="phead">
            <div className="ptitle">Invoices</div>
            <div className="spacer" />
            <div className="sub">Outstanding: <b style={{ color: outstanding > 0 ? "var(--crit)" : "var(--ok)" }}>{taka(outstanding)}</b></div>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr><th>Invoice</th><th>Month</th><th>Due</th><th className="n">Net</th><th className="n">Paid</th><th className="n">Balance</th><th className="n">Status</th></tr>
              </thead>
              <tbody>
                {(invoices ?? []).map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="mono"><b>{inv.invoice_no}</b></td>
                    <td className="mono sub">{inv.billing_month}</td>
                    <td className="mono sub">{inv.due_on}</td>
                    <td className="n mono">{taka(inv.net)}</td>
                    <td className="n mono">{taka(inv.paid)}</td>
                    <td className="n mono">{taka(inv.balance)}</td>
                    <td className="n"><StatusChip status={inv.status} map={invoiceStatusMap} /></td>
                  </tr>
                ))}
                {(invoices ?? []).length === 0 && (
                  <tr><td colSpan={7} className="sub">No invoices yet — the monthly billing run will generate one, or run one from Billing.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {isAdmin && (
          <div className="panel">
            <div className="phead"><div className="ptitle">Record a payment</div></div>
            <div style={{ padding: 18 }}>
              <PaymentForm studentId={id} outstanding={outstanding} />
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
