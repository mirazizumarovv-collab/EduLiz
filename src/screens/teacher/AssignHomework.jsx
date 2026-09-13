import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { CURRENT_DATE_STR } from "../../constants/months.js";
import { getHomeworkStatusForStudent } from "../../utils/calculations.js";
import { Button } from "../../components/common/UI.jsx";

const STATUS_COLOR = { completed: "good", overdue: "bad", pending: "medium" };

export default function AssignHomework() {
  const { t, theme, myGroups, addHomework, homeworkRecords, homeworkSubmissions, toggleHomeworkSubmission, students } = useApp();
  const c = theme.colors;
  const [groupId, setGroupId] = useState(myGroups[0]?.id || "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState(CURRENT_DATE_STR);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const group = myGroups.find(g => g.id === groupId);
  const list = (homeworkRecords[groupId] || []).slice().reverse();

  const handleSave = () => {
    if (!title.trim() || !groupId) return;
    if (dueDate < CURRENT_DATE_STR) { setError(t("dueDateInPast")); return; }
    addHomework(groupId, title.trim(), dueDate);
    setTitle("");
    setError("");
    setSaved(true);
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("navHomework")}</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select value={groupId} onChange={(e) => { setGroupId(e.target.value); setSaved(false); }} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
          {myGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} placeholder={t("homeworkTitlePlaceholder")}
          style={{ flex: 1, minWidth: 220, border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}
        />
        <input
          type="date" value={dueDate} min={CURRENT_DATE_STR} onChange={(e) => { setDueDate(e.target.value); setError(""); }}
          style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}
        />
      </div>

      <Button onClick={handleSave} style={{ width: "100%", maxWidth: 260, marginBottom: 10 }}>{t("assignHomework")}</Button>
      {error && <div style={{ fontSize: 12.5, color: c.danger, marginBottom: 10 }}>{error}</div>}
      {saved && <div style={{ fontSize: 12.5, color: c.good, marginBottom: 20 }}>✓ {t("homeworkAssigned")}</div>}

      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginTop: 24, marginBottom: 10 }}>{t("assignedHomeworkList")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 && <div style={{ fontSize: 12.5, color: c.textSecondary }}>—</div>}
        {list.map(hw => {
          const completedCount = group ? group.studentIds.filter(sid => getHomeworkStatusForStudent(hw, sid, homeworkSubmissions, CURRENT_DATE_STR) === "completed").length : 0;
          return (
            <div key={hw.id} style={{ background: c.surface, borderRadius: 10, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: c.textPrimary }}>{hw.title}</div>
                  <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{t("dueDate")}: {hw.dueDate}</div>
                </div>
                <button onClick={() => setOpenId(openId === hw.id ? null : hw.id)} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: c.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  <CheckCircle2 size={14} /> {completedCount}/{group?.studentIds.length || 0}
                </button>
              </div>
              {openId === hw.id && group && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {group.studentIds.map(sid => {
                    const s = students.find(st => st.id === sid);
                    if (!s) return null;
                    const status = getHomeworkStatusForStudent(hw, sid, homeworkSubmissions, CURRENT_DATE_STR);
                    return (
                      <label key={sid} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, color: c.textPrimary, background: c.surfaceAlt, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="checkbox" checked={status === "completed"} onChange={(e) => toggleHomeworkSubmission(hw.id, sid, e.target.checked)} />
                          {s.name}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c[STATUS_COLOR[status]] }}>{t(status)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
