import React, { useState, useEffect } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";
import { windowStartISO } from "../../utils/clock.js";
import { checkScore } from "../../utils/gradeModel.js";

export default function EnterGrades() {
  const {
    t, theme, myGroups, students, assessments, gradeRows,
    addGrades, editAssessment, deleteAssessment, showToast, today,
  } = useApp();
  const earliest = windowStartISO(today); // the first day of the months in view
  const c = theme.colors;
  const getStudent = (id) => students.find(s => s.id === id) || null;

  const [groupId, setGroupId] = useState(myGroups[0]?.id || "");
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState(20);
  const [date, setDate] = useState(today);
  const [scores, setScores] = useState({});
  const [savedMsg, setSavedMsg] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);       // null = entering a NEW assessment
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const group = myGroups.find(g => g.id === groupId);
  // This group's own tests, newest first.
  const groupAssessments = group
    ? assessments.filter(a => a.groupId === group.id).slice().sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const editing = editingId ? assessments.find(a => a.id === editingId) || null : null;

  // The assessment being edited can vanish underneath us (deleted from another
  // tab) — drop out of edit mode rather than keep editing something gone.
  useEffect(() => {
    if (editingId && !editing) { setEditingId(null); setError(t("errorAssessmentNotFound")); }
  }, [editingId, editing, t]);

  const clearMessages = () => { setSavedMsg(""); setError(""); };
  const blankForm = () => { setTitle(""); setMaxScore(20); setScores({}); setDate(today); };

  const setScore = (studentId, val) => {
    setScores(prev => ({ ...prev, [studentId]: val }));
    clearMessages();
  };

  const startEdit = (a) => {
    const current = {};
    gradeRows.filter(g => g.assessmentId === a.id).forEach(g => { current[g.studentId] = String(g.score); });
    setEditingId(a.id);
    setTitle(a.title); setMaxScore(a.maxScore); setDate(a.date); setScores(current);
    setConfirmDeleteId(null); clearMessages();
    if (typeof window !== "undefined" && window.scrollTo) window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const cancelEdit = () => { setEditingId(null); blankForm(); clearMessages(); };

  const changeGroup = (id) => {
    setGroupId(id);
    setScores({});                      // another group's students — never carry typed scores across
    if (editingId) cancelEdit();
    setConfirmDeleteId(null);
    clearMessages();
  };

  // Why a save was refused, in words.
  const reasonMessage = (reason) => ({
    title: t("enterAssessmentTitle"),
    date: t("errorDateInvalid"),
    maxScore: t("invalidMaxScore"),
    dateFuture: t("errorDateFuture"),
    dateTooEarly: t("errorDateTooEarly", { date: earliest }),
    duplicate: t("errorAssessmentDuplicate", { title: title.trim() }),
    noScores: t("errorAssessmentNoScores"),
    scoreRange: t("errorScoreAboveMax"),
    notFound: t("errorAssessmentNotFound"),
  }[reason] || t("errorAssessmentNotFound"));

  const handleSave = () => {
    if (!group) return;
    const maxNum = Number(maxScore);
    // Only THIS group's students count — not whatever was typed for another group.
    // A score is saved exactly as typed or not at all. It used to be quietly pulled
    // into range (25 out of 20 became 20, -5 became 0) while the screen said
    // "saved" — the teacher believed one number and the system kept another.
    const typed = {};
    for (const sid of group.studentIds) {
      const v = scores[sid];
      if (v === undefined || v === "") continue;
      const r = checkScore(v, maxNum);
      if (!r.ok) {
        const name = getStudent(sid)?.name || "";
        setError(r.reason === "negative" ? t("errorScoreNegative", { name })
          : r.reason === "aboveMax" ? t("errorScoreAbove", { name, max: maxNum })
          : t("errorScoreAboveMax"));
        return;
      }
      typed[sid] = r.value;
    }

    if (editing) {
      // A blank box means "no score" — which removes one that was there.
      const patch = {};
      for (const sid of group.studentIds) patch[sid] = typed[sid] !== undefined ? typed[sid] : null;
      const r = editAssessment(editing.id, { title, date, maxScore: maxNum, scores: patch });
      if (!r.ok) { setError(reasonMessage(r.reason)); return; }
      setEditingId(null); blankForm(); setError("");
      setSavedMsg(t("assessmentUpdated"));
      return;
    }

    // Partial grading is allowed on purpose — unlike Attendance (a daily
    // fact that should always be recorded for every student), a single
    // assessment score is naturally entered selectively: a student may
    // have been absent for the quiz, or scores may be entered as papers
    // are corrected rather than all at once. Only "at least one score"
    // is required, not "every student in the group".
    if (Object.keys(typed).length === 0) { setError(t("enterAtLeastOneScore")); return; }
    const r = addGrades(group.id, group.subject, title.trim(), maxNum, typed, date);
    if (!r.ok) { setError(reasonMessage(r.reason)); return; }
    setError("");
    setSavedMsg(r.updated ? t("assessmentUpdated") : t("gradesSaved"));
    setTitle(""); setScores({});        // the date stays: several tests for one day are entered in a row
  };

  const handleDelete = (a) => {
    deleteAssessment(a.id);
    if (editingId === a.id) cancelEdit();
    setConfirmDeleteId(null);
    showToast(t("assessmentDeleted"));
  };

  const field = { border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 };
  const smallBtn = (bg, fg) => ({ border: "none", background: bg, color: fg, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" });

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 4 }}>{t("navGrades")}</div>
      {group && <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 18 }}>{t("gradesFor", { group: group.name })}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={groupId} onChange={(e) => changeGroup(e.target.value)} style={field}>
          {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {editing && (
        <div role="status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: c.surfaceAlt, border: `1px solid ${c.accent}`, borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontSize: 12.5, color: c.textPrimary }}>
          <span>{t("editingAssessment", { title: editing.title, date: editing.date })}</span>
          <button onClick={cancelEdit} style={smallBtn(c.surface, c.textSecondary)}>{t("cancel")}</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={title} onChange={(e) => { setTitle(e.target.value); clearMessages(); }} placeholder={t("assessmentTitlePlaceholder")}
          style={{ ...field, flex: 1, minWidth: 200 }}
        />
        <input
          type="number" min={1} value={maxScore} onChange={(e) => { setMaxScore(e.target.value); clearMessages(); }} placeholder={t("maxScore")}
          style={{ ...field, width: 100 }}
        />
        <input
          type="date" aria-label={t("assessmentDate")} value={date} min={earliest} max={today}
          onChange={(e) => { setDate(e.target.value); clearMessages(); }}
          style={{ ...field, width: 150 }}
        />
      </div>

      <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 10 }}>{t("enterScorePer")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {group?.studentIds.map(sid => {
          const s = getStudent(sid);
          if (!s) return null;
          return (
            <div key={sid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: c.surface, borderRadius: 12, padding: "12px 16px" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.name}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number" min={0} max={maxScore} value={scores[sid] ?? ""} onChange={(e) => setScore(sid, e.target.value)}
                  style={{ width: 64, border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 10px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13, textAlign: "center" }}
                />
                <span style={{ fontSize: 12, color: c.textSecondary }}>/ {maxScore}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} style={{ width: "100%", maxWidth: 260 }}>{editing ? t("saveChanges") : t("saveGrades")}</Button>
      {error && <div role="alert" style={{ fontSize: 12.5, color: c.danger, marginTop: 10 }}>{error}</div>}
      {savedMsg && <div style={{ fontSize: 12.5, color: c.good, marginTop: 10 }}>✓ {savedMsg}</div>}

      {group && groupAssessments.length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{t("groupAssessments")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groupAssessments.map(a => {
              const graded = gradeRows.filter(g => g.assessmentId === a.id).length;
              const isEditing = editingId === a.id;
              return (
                <div key={a.id} data-assessment={a.id} style={{ background: c.surfaceAlt, borderRadius: 8, padding: "8px 12px", border: isEditing ? `1px solid ${c.accent}` : "1px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12.5, color: c.textSecondary }}>
                      {a.title} — {a.date}
                      <span style={{ marginLeft: 8, fontSize: 11 }}>· {t("gradedCount", { n: graded, total: group.studentIds.length })}</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(a)} style={smallBtn(c.surface, c.textPrimary)}>{t("edit")}</button>
                      <button onClick={() => setConfirmDeleteId(a.id)} style={smallBtn(c.surface, c.danger)}>{t("delete")}</button>
                    </div>
                  </div>
                  {confirmDeleteId === a.id && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${c.border}` }}>
                      <div style={{ fontSize: 12, color: c.textPrimary, marginBottom: 8 }}>{t("confirmDeleteAssessmentBody", { title: a.title, date: a.date, n: graded })}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => handleDelete(a)} style={smallBtn(c.danger, c.onAccent)}>{t("confirmDelete")}</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={smallBtn(c.surface, c.textSecondary)}>{t("cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
