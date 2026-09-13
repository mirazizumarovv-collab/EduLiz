import React, { useState, useMemo } from "react";
import { Check, Clock, X } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { CURRENT_DATE_STR } from "../../constants/months.js";
import { Button } from "../../components/common/UI.jsx";

const STATUS_OPTS = [
  { key: "P", Icon: Check, color: "good" },
  { key: "L", Icon: Clock, color: "medium" },
  { key: "A", Icon: X, color: "bad" },
];

export default function MarkAttendance() {
  const { t, theme, myGroups, attendanceRecords, saveAttendance, students } = useApp();
  const c = theme.colors;
  const getStudent = (id) => students.find(s => s.id === id) || null;
  const [groupId, setGroupId] = useState(myGroups[0]?.id || "");
  const [date, setDate] = useState(CURRENT_DATE_STR);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const group = myGroups.find(g => g.id === groupId);
  const existing = (attendanceRecords[groupId] || {})[date] || {};
  const [entries, setEntries] = useState(existing);

  // Re-sync draft entries when switching group/date
  useMemo(() => { setEntries((attendanceRecords[groupId] || {})[date] || {}); setSaved(false); setError(""); }, [groupId, date]); // eslint-disable-line

  const setStatus = (studentId, status) => {
    setEntries(prev => ({ ...prev, [studentId]: { status, lateBy: status === "L" ? (prev[studentId]?.lateBy || 5) : undefined } }));
    setSaved(false);
    setError("");
  };
  const setLateBy = (studentId, mins) => {
    setEntries(prev => ({ ...prev, [studentId]: { ...prev[studentId], lateBy: mins } }));
  };

  const handleSave = () => {
    const unmarked = (group?.studentIds || []).filter(sid => !entries[sid]?.status);
    if (unmarked.length > 0) {
      setError(t("markEveryoneFirst", { count: unmarked.length }));
      return;
    }
    saveAttendance(groupId, date, entries);
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
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
      </div>

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
                    type="number" min={1} value={entry.lateBy || 5}
                    onChange={(e) => setLateBy(sid, Number(e.target.value))}
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
      {error && <div style={{ fontSize: 12.5, color: c.danger, marginTop: 10 }}>{error}</div>}
      {saved && <div style={{ fontSize: 12.5, color: c.good, marginTop: 10 }}>✓ {t("attendanceSaved")}</div>}
    </div>
  );
}
