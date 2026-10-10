"use client";
import { Fragment, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { addClassSlot, deleteClassSlot, updateClassSlot } from "./actions";
import { WEEKDAYS, fmtTime } from "./shared";
import { groupSubjects, type SubjectForGrouping } from "@/lib/subjectGroups";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

type Subject = SubjectForGrouping;
type TeacherSubject = { teacher_id: string; subject_id: string };
type ClassLevel = { id: string; name: string; programme?: { code: string; name: string } | null };
type Teacher = { id: string; full_name: string };
type Slot = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  room: string | null;
  capacity: number | null;
  teacher_id: string | null;
  isJunior: boolean;
  ownerTeacherId: string | null;
  label: string;
};

type Draft = { weekday: string; start: string; end: string; room: string };

const roomKey = (r: string | null | undefined) =>
  (r ?? "").trim().toLowerCase().replace(/^room\s*/, "").replace(/\s+/g, "") || null;

function readDraft(form: HTMLFormElement): Draft {
  const f = new FormData(form);
  return {
    weekday: String(f.get("weekday") ?? ""),
    start: String(f.get("start_time") ?? ""),
    end: String(f.get("end_time") ?? ""),
    room: String(f.get("room") ?? ""),
  };
}

/** The slot already using this room at an overlapping time on the same day, if any. */
function findRoomClash(slots: Slot[], d: Draft, ignoreId?: string): Slot | null {
  const key = roomKey(d.room);
  if (!key || d.weekday === "" || !d.start || !d.end || d.end <= d.start) return null;
  return (
    slots.find(
      (o) =>
        o.id !== ignoreId &&
        o.weekday === Number(d.weekday) &&
        roomKey(o.room) === key &&
        o.start_time.slice(0, 5) < d.end &&
        d.start < o.end_time.slice(0, 5)
    ) ?? null
  );
}

function ClashWarning({ clash, room }: { clash: Slot; room: string }) {
  return (
    <div className="sub" role="alert" style={{ color: "var(--crit)", fontWeight: 500 }}>
      Room {room.trim().replace(/^room\s*/i, "")} is already booked on {WEEKDAYS[clash.weekday]} from {fmtTime(clash.start_time)} to{" "}
      {fmtTime(clash.end_time)} for {clash.label}. Choose another room or time.
    </div>
  );
}

function levelLabel(l: ClassLevel) {
  return `${l.programme?.name ?? ""} — ${l.name}`;
}

function AddSlotForm({
  mode,
  myTeacherId,
  slots,
  subjects,
  teachers,
  teacherSubjects,
  classLevels,
}: {
  mode: "admin" | "teacher";
  myTeacherId: string | null;
  slots: Slot[];
  subjects: Subject[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
  classLevels: ClassLevel[];
}) {
  const [state, action, pending] = useActionState(addClassSlot, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [targetType, setTargetType] = useState<"class_group" | "class_level">("class_group");
  const [subjectId, setSubjectId] = useState("");
  const [draft, setDraft] = useState<Draft>({ weekday: "", start: "", end: "", room: "" });
  const clash = findRoomClash(slots, draft);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSubjectId("");
      setDraft({ weekday: "", start: "", end: "", room: "" });
    }
  }, [state]);

  const subjectGroups = useMemo(() => groupSubjects(subjects), [subjects]);
  const eligibleTeachers = useMemo(() => {
    if (!subjectId) return [];
    const ids = new Set(teacherSubjects.filter((ts) => ts.subject_id === subjectId).map((ts) => ts.teacher_id));
    return teachers.filter((t) => ids.has(t.id));
  }, [subjectId, teacherSubjects, teachers]);

  return (
    <form
      ref={formRef}
      action={action}
      onChange={(e) => setDraft(readDraft(e.currentTarget))}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {mode === "teacher" && <input type="hidden" name="target_type" value="class_group" />}
      {mode === "admin" && <div className="field" style={{ maxWidth: 260 }}>
        <label className="lbl">This slot is for<Req /></label>
        <select
          style={inputStyle}
          name="target_type"
          value={targetType}
          onChange={(e) => setTargetType(e.target.value as "class_group" | "class_level")}
        >
          <option value="class_group">A subject class (O/A Level)</option>
          <option value="class_level">A junior class</option>
        </select>
      </div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {targetType === "class_group" ? (
          <>
            <div className="field">
              <label className="lbl">Subject<Req /></label>
              <select
                style={inputStyle}
                name="subject_id"
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
              >
                <option value="" disabled>Choose…</option>
                {subjectGroups.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            {mode === "teacher" ? (
              <input type="hidden" name="teacher_id" value={myTeacherId ?? ""} />
            ) : (
            <div className="field">
              <label className="lbl">Teacher<Req /></label>
              <select key={subjectId} style={inputStyle} name="teacher_id" required defaultValue="" disabled={!subjectId}>
                <option value="" disabled>
                  {subjectId ? (eligibleTeachers.length ? "Choose…" : "No teacher mapped to this subject") : "Choose a subject first"}
                </option>
                {eligibleTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            )}
            <div className="field">
              <label className="lbl">Batch</label>
              <input style={inputStyle} type="text" name="batch" placeholder="1" />
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label className="lbl">Junior class<Req /></label>
              <select style={inputStyle} name="class_level_id" required defaultValue="">
                <option value="" disabled>Choose…</option>
                {classLevels.map((l) => (
                  <option key={l.id} value={l.id}>{levelLabel(l)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="lbl">Teacher (optional)</label>
              <select style={inputStyle} name="teacher_id" defaultValue="">
                <option value="">Not set</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="field">
          <label className="lbl">Day<Req /></label>
          <select style={inputStyle} name="weekday" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Start time<Req /></label>
          <input style={inputStyle} type="time" name="start_time" required />
        </div>
        <div className="field">
          <label className="lbl">End time<Req /></label>
          <input style={inputStyle} type="time" name="end_time" required />
        </div>
        <div className="field">
          <label className="lbl">Room<Req /></label>
          <input style={inputStyle} type="text" name="room" required placeholder="e.g. 401" />
        </div>
        <div className="field">
          <label className="lbl">Capacity (optional)</label>
          <input style={inputStyle} type="number" name="capacity" min="1" step="1" />
        </div>
      </div>

      {clash && <ClashWarning clash={clash} room={draft.room} />}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button className="btn" type="submit" disabled={pending || !!clash} style={{ alignSelf: "flex-start" }}>
          {pending ? "Adding…" : "+ Add to schedule"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Added.</span>}
      </div>
    </form>
  );
}

function EditSlotForm({ slot, slots, teachers, teacherMode }: { slot: Slot; slots: Slot[]; teachers: Teacher[]; teacherMode?: boolean }) {
  const [state, action, pending] = useActionState(updateClassSlot, null);
  const [draft, setDraft] = useState<Draft>({
    weekday: String(slot.weekday), start: slot.start_time.slice(0, 5), end: slot.end_time.slice(0, 5), room: slot.room ?? "",
  });
  const unchanged =
    draft.weekday === String(slot.weekday) && draft.start === slot.start_time.slice(0, 5) &&
    draft.end === slot.end_time.slice(0, 5) && roomKey(draft.room) === roomKey(slot.room);
  // A slot that already clashes can still have its capacity or teacher changed; only a move is checked.
  const clash = unchanged ? null : findRoomClash(slots, draft, slot.id);
  return (
    <form action={action} onChange={(e) => setDraft(readDraft(e.currentTarget))} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input type="hidden" name="id" value={slot.id} />
      <input type="hidden" name="is_junior" value={String(slot.isJunior)} />
      {teacherMode && slot.isJunior && <input type="hidden" name="teacher_id" value={slot.teacher_id ?? ""} />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
        <div className="field">
          <label className="lbl">Day</label>
          <select style={inputStyle} name="weekday" defaultValue={slot.weekday}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Start time</label>
          <input style={inputStyle} type="time" name="start_time" defaultValue={slot.start_time.slice(0, 5)} required />
        </div>
        <div className="field">
          <label className="lbl">End time</label>
          <input style={inputStyle} type="time" name="end_time" defaultValue={slot.end_time.slice(0, 5)} required />
        </div>
        <div className="field">
          <label className="lbl">Room<Req /></label>
          <input style={inputStyle} type="text" name="room" required defaultValue={slot.room ?? ""} />
        </div>
        <div className="field">
          <label className="lbl">Capacity</label>
          <input style={inputStyle} type="number" name="capacity" min="1" step="1" defaultValue={slot.capacity ?? ""} />
        </div>
        {slot.isJunior && !teacherMode && (
          <div className="field">
            <label className="lbl">Teacher</label>
            <select style={inputStyle} name="teacher_id" defaultValue={slot.teacher_id ?? ""}>
              <option value="">Not set</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.full_name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {clash && <ClashWarning clash={clash} room={draft.room} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn ghost" type="submit" disabled={pending || !!clash} style={{ fontSize: 12 }}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
        {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
      </div>
    </form>
  );
}

export default function RosterAdmin({
  mode = "admin",
  myTeacherId = null,
  slots,
  subjects,
  classLevels,
  teachers,
  teacherSubjects,
}: {
  mode?: "admin" | "teacher";
  myTeacherId?: string | null;
  slots: Slot[];
  subjects: Subject[];
  classLevels: ClassLevel[];
  teachers: Teacher[];
  teacherSubjects: TeacherSubject[];
}) {
  const [open, setOpen] = useState<string | null>(null);
  // A teacher manages only their own slots; every slot still counts for room clashes.
  const mine = useMemo(
    () => (mode === "teacher" ? slots.filter((s) => myTeacherId && s.ownerTeacherId === myTeacherId) : slots),
    [slots, mode, myTeacherId]
  );
  const sorted = useMemo(() => [...mine].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)), [mine]);

  return (
    <>
      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">Add to schedule</div>
          <div className="sub">
            {mode === "teacher"
              ? "Your own classes only, for the subjects you teach. A room can't be booked twice at the same time."
              : "Admin can schedule any class; teachers can schedule their own. A room can't be booked twice at the same time."}
          </div>
        </summary>
        <div style={{ padding: 16 }}>
          <AddSlotForm mode={mode} myTeacherId={myTeacherId} slots={slots} subjects={subjects} teachers={teachers} teacherSubjects={teacherSubjects} classLevels={classLevels} />
        </div>
      </details>

      <details className="panel collapsible" open>
        <summary className="phead">
          <div className="ptitle">{mode === "teacher" ? "Your classes" : "Manage slots"}</div>
          <div className="sub">{sorted.length} total</div>
        </summary>
        <div className="tblwrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Time</th>
                <th>Class</th>
                <th className="n"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const isOpen = open === s.id;
                return (
                  <Fragment key={s.id}>
                    <tr>
                      <td>{WEEKDAYS[s.weekday]}</td>
                      <td className="mono">{fmtTime(s.start_time)} – {fmtTime(s.end_time)}</td>
                      <td><b>{s.label}</b></td>
                      <td className="n">
                        <button
                          className="btn ghost"
                          type="button"
                          style={{ fontSize: 12, padding: "6px 10px" }}
                          onClick={() => setOpen(isOpen ? null : s.id)}
                        >
                          {isOpen ? "Close" : "Manage"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={4} style={{ padding: "12px 16px", background: "var(--tint)" }}>
                          <EditSlotForm slot={s} slots={slots} teachers={teachers} teacherMode={mode === "teacher"} />
                          <form action={deleteClassSlot} style={{ marginTop: 12 }}>
                            <input type="hidden" name="id" value={s.id} />
                            <button className="btn ghost" type="submit" style={{ fontSize: 12, color: "var(--crit)" }}>
                              Remove from schedule
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="sub">Nothing scheduled yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
