"use client";
import { useActionState, useEffect, useRef } from "react";
import Req from "@/components/Req";
import { submitAnnouncementRequest, withdrawAnnouncementRequest } from "./actions";
import { fmtDhaka, targetLabel } from "./shared";
import MyAnnouncements from "./MyAnnouncements";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type ClassGroup = { id: string; batch_name: string; subject?: { name: string; level: string | null } | null };

function groupLabel(g: ClassGroup) {
  const level = g.subject?.level ? ` (${g.subject.level.toUpperCase()})` : "";
  return `${g.subject?.name ?? ""}${level} — Batch ${g.batch_name}`;
}

function StatusChip({ status }: { status: string }) {
  if (status === "published") return <span className="st paid"><span className="dot" />Approved &amp; live</span>;
  if (status === "declined") return <span className="st over"><span className="dot" />Declined</span>;
  if (status === "unpublished") return <span className="st past"><span className="dot" />Taken down</span>;
  return <span className="st due"><span className="dot" />Awaiting admin</span>;
}

function RequestForm({ classGroups }: { classGroups: ClassGroup[] }) {
  const [state, action, pending] = useActionState(submitAnnouncementRequest, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="field">
        <label className="lbl">Class<Req /></label>
        <select style={inputStyle} name="class_group_id" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {classGroups.map((g) => (
            <option key={g.id} value={g.id}>{groupLabel(g)}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="lbl">Title<Req /></label>
        <input style={inputStyle} type="text" name="title" required />
      </div>
      <div className="field">
        <label className="lbl">Message<Req /></label>
        <textarea style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} name="body" required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Share from<Req /></label>
          <input style={inputStyle} type="datetime-local" name="publish_at" required />
        </div>
        <div className="field">
          <label className="lbl">Until<Req /></label>
          <input style={inputStyle} type="datetime-local" name="expires_at" required />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Sending…" : "Send request to admin"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Sent — admin will review it.</span>}
      </div>
      <div className="sub">
        This goes to the admin as a request, not straight to your class — it only becomes visible
        to students once approved.
      </div>
    </form>
  );
}

export default function TeacherAnnouncements({
  classGroups,
  myRequests,
  published,
  hasTeacherRecord,
}: {
  classGroups: ClassGroup[];
  myRequests: any[];
  published: any[];
  hasTeacherRecord: boolean;
}) {
  if (!hasTeacherRecord) {
    return (
      <div className="panel" style={{ padding: 18 }}>
        <div className="sub">Your account isn&apos;t linked to a teacher record yet — ask an admin to check your invite.</div>
      </div>
    );
  }

  return (
    <>
      <div className="panel">
        <div className="phead">
          <div className="ptitle">Request an announcement</div>
        </div>
        <div style={{ padding: 16 }}>
          <RequestForm classGroups={classGroups} />
        </div>
      </div>

      <div className="panel">
        <div className="phead">
          <div className="ptitle">My requests</div>
          <div className="sub">{myRequests.length} total</div>
        </div>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Title</th>
                <th>Window</th>
                <th>Status</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {myRequests.map((r) => (
                <tr key={r.id}>
                  <td className="sub">{targetLabel((r.announcement_target ?? [])[0] ?? null, r.scope)}</td>
                  <td><b>{r.title}</b></td>
                  <td className="sub">{fmtDhaka(r.publish_at)} – {fmtDhaka(r.expires_at)}</td>
                  <td><StatusChip status={r.status} />{r.status === "declined" && r.decision_note && (
                    <div className="sub" style={{ marginTop: 4 }}>“{r.decision_note}”</div>
                  )}</td>
                  <td className="n">
                    {r.status === "pending_review" && (
                      <form action={withdrawAnnouncementRequest}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                          Withdraw
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {myRequests.length === 0 && (
                <tr><td colSpan={5} className="sub">No requests yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="lbl" style={{ margin: "4px 0 10px" }}>Live announcements for your classes</div>
        <MyAnnouncements announcements={published} />
      </div>
    </>
  );
}
