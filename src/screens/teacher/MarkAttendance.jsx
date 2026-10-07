import React, { useState, useEffect } from "react";
import { Check, Clock, X } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";
import { windowStartISO } from "../../utils/clock.js";
import { LATE_BY_MIN, LATE_BY_MAX } from "../../utils/attendanceRules.js";

const STATUS_OPTS = [
  { key: "P", Icon: Check, color: "good" },
  { key: "L", Icon: Clock, color: "medium" },
  { key: "A", Icon: X, color: "bad" },
];

// A comparable fingerprint of a sheet — who is marked what, and how late —
// that ignores bookkeeping fields (like the lesson stamp). Two sheets with the
// same fingerprint say the same thing.
const fingerprint = (entries) =>
  JSON.stringify(Object.keys(entries || {}).sort().map(sid => [sid, entries[sid]?.status ?? null, entries[sid]?.status === "L" ? String(entries[sid]?.lateBy ?? "") : ""]));

export default function MarkAttendance() {
  const { t, theme, myGroups, attendanceRecords, saveAttendance, students, today } = useApp();
  const c = theme.colors;
  const earliest = windowStartISO(today);
  const getStudent = (id) => students.find(s => s.id === id) || null;
  const [groupId, setGroupId] = useState(myGroups[0]?.id || "");
  const [date, setDate] = useState(today);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const group = myGroups.find(g => g.id === groupId);
  const canonical = (attendanceRecords[groupId] || {})[date] || {};   // what is stored for this group + day right now
  const canonicalPrint = fingerprint(canonical);

  // The draft the teacher is editing, and the fingerprint of the stored sheet it
  // started from. That is how we tell, when the stored sheet changes (another
  // tab, another teacher), whether the open form is just out of date or has
  // unsaved edits that a Save would now trample.
  const [entries, setEntries] = useState(canonical);
  const [baseline, setBaseline] = useState(canonicalPrint);
  const dirty = fingerprint(entries) !== baseline;      // the teacher has changed something
  const stale = canonicalPrint !== baseline;            // the stored sheet moved on since the draft was loaded

  const adopt = (sheet) => { setEntries(sheet); setBaseline(fingerprint(sheet)); };

  // Switching group or day: load that sheet.
  useEffect(() => {
    adopt((attendanceRecords[groupId] || {})[date] || {});
    setSaved(false);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, date]);

  // The stored sheet changed under an open form. With nothing edited yet, just
  // show the new one; with edits, leave the draft alone and say so (below).
  useEffect(() => {
    if (stale && !dirty) adopt(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonicalPrint]);

  const setStatus = (studentId, status) => {
    setEntries(prev => ({ ...prev, [studentId]: { ...prev[studentId], status, lateBy: status === "L" ? (prev[studentId]?.lateBy ?? 5) : undefined } }));
    setSaved(false);
    setError("");
  };
  // Kept exactly as typed (an empty box stays empty) — it is checked when saving,
  // never quietly turned into some default.
  const setLateBy = (studentId, raw) => {
    setEntries(prev => ({ ...prev, [studentId]: { ...prev[studentId], lateBy: raw } }));
    setSaved(false);
    setError("");
  };

  const messageFor = (r) => ({
    date: t("errorDateInvalid"),
    dateFuture: t("errorDateFuture"),
    dateTooEarly: t("errorDateTooEarly", { date: earliest }),
    unmarked: t("markEveryoneFirst", { count: r.studentIds?.length }),
    lateBy: t("errorLateBy", { name: getStudent(r.studentId)?.name || "", min: LATE_BY_MIN, max: LATE_BY_MAX }),
    notFound: t("errorAssessmentNotFound"),
  }[r.reason] || t("errorAssessmentNotFound"));

  const handleSave = () => {
    if (stale) { setError(t("attendanceChangedElsewhere")); return; }   // never overwrite a sheet we haven't seen
    const r = saveAttendance(groupId, date, entries);
    if (!r.ok) { setError(messageFor(r)); return; }
    adopt(r.entries);                                                    // the form now matches what is stored
    setError("");
    setSaved(true);
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 4 }}>{t("navAttendance")}</div>
      {group && <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 18 }}>{t("attendanceFor", { group: group.name })}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
          {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <input type="date" aria-label={t("assessmentDate")} value={date} min={earliest} max={today} onChange={(e) => setDate(e.target.value > today ? today : e.target.value)} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
      </div>

      {stale && dirty && (
        <div role="status" data-conflict style={{ background: c.surfaceAlt, border: `1px solid ${c.warning}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14, fontSize: 12.5, color: c.textPrimary }}>
          <div style={{ marginBottom: 8 }}>{t("attendanceChangedElsewhere")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { adopt(canonical); setError(""); }} style={{ border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("loadLatest")}</button>
            <button onClick={() => { setBaseline(canonicalPrint); setError(""); }} style={{ border: "none", background: c.surface, color: c.textSecondary, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("keepMine")}</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {group?.studentIds.map(sid => {
          const s = getStudent(sid);
          if (!s) return null;
          const entry = entries[sid];
          return (
            <div key={sid} style={{ background: c.surface, borderRadius: 12, padding: 14, border: entry?.status ? "1px solid transparent" : `1px dashed ${c.warning}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.name}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {STATUS_OPTS.map(opt => {
                    const isActive = entry?.status === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => setStatus(sid, opt.key)}
                        aria-label={opt.key === "P" ? t("present") : opt.key === "L" ? t("late") : t("absent")}
                        style={{
                          width: 38, height: 38, borderRadius: 10, border: "none", cursor: "pointer",
                          background: isActive ? c[opt.color] : c.surfaceAlt, color: isActive ? c.onAccent : c.textSecondary,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <opt.Icon size={17} />
                      </button>
                    );
                  })}
                </div>
              </div>
              {entry?.status === "L" && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: c.textSecondary }}>{t("lateBy")}</span>
                  <input
                    type="number" min={LATE_BY_MIN} max={LATE_BY_MAX} step={1} value={entry.lateBy ?? ""}
                    onChange={(e) => setLateBy(sid, e.target.value)}
                    style={{ width: 64, border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 8px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 12.5 }}
                  />
                  <span style={{ fontSize: 12, color: c.textSecondary }}>{t("minutes")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} style={{ width: "100%", maxWidth: 260 }}>{t("saveAttendance")}</Button>
      {error && <div role="alert" style={{ fontSize: 12.5, color: c.danger, marginTop: 10 }}>{error}</div>}
      {saved && <div style={{ fontSize: 12.5, color: c.good, marginTop: 10 }}>✓ {t("attendanceSaved")}</div>}
    </div>
  );
}
