import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";

export default function EnterGrades() {
  const { t, theme, myGroups, addGrades, gradesRecords, students } = useApp();
  const c = theme.colors;
  const getStudent = (id) => students.find(s => s.id === id) || null;
  const [groupId, setGroupId] = useState(myGroups[0]?.id || "");
  const [title, setTitle] = useState("");
  const [maxScore, setMaxScore] = useState(20);
  const [scores, setScores] = useState({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const group = myGroups.find(g => g.id === groupId);

  const setScore = (studentId, val) => {
    setScores(prev => ({ ...prev, [studentId]: val }));
    setSaved(false);
    setError("");
  };

  const handleSave = () => {
    const maxNum = Number(maxScore);
    if (!title.trim() || !group) return;
    if (!Number.isFinite(maxNum) || maxNum <= 0) { setError(t("invalidMaxScore")); return; }
    const numericScores = {};
    for (const [sid, v] of Object.entries(scores)) {
      if (v === "") continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      numericScores[sid] = Math.max(0, Math.min(n, maxNum)); // clamp at the data level, not just the input's UI max
    }
    if (Object.keys(numericScores).length === 0) { setError(t("enterAtLeastOneScore")); return; }
    addGrades(group.subject, title.trim(), maxNum, numericScores);
    setSaved(true);
    setTitle(""); setScores({});
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 4 }}>{t("navGrades")}</div>
      {group && <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 18 }}>{t("gradesFor", { group: group.name })}</div>}

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
          {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("assessmentTitlePlaceholder")}
          style={{ flex: 1, minWidth: 200, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}
        />
        <input
          type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(e.target.value)} placeholder={t("maxScore")}
          style={{ width: 100, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}
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

      <Button onClick={handleSave} style={{ width: "100%", maxWidth: 260 }}>{t("saveGrades")}</Button>
      {error && <div style={{ fontSize: 12.5, color: c.danger, marginTop: 10 }}>{error}</div>}
      {saved && <div style={{ fontSize: 12.5, color: c.good, marginTop: 10 }}>✓ {t("gradesSaved")}</div>}

      {group && (gradesRecords[group.studentIds[0]] || []).length > 0 && (
        <div style={{ marginTop: 30 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{t("recentAssessments")}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(gradesRecords[group.studentIds[0]] || []).slice(-5).reverse().map(g => (
              <div key={g.id} style={{ fontSize: 12.5, color: c.textSecondary, background: c.surfaceAlt, borderRadius: 8, padding: "8px 12px" }}>
                {g.title} — {g.date}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
