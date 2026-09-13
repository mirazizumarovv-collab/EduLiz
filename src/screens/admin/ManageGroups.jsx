import React, { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";

const emptyForm = { name: "", subject: "", teacherId: "", schedule: "" };

export default function ManageGroups() {
  const { t, theme, groups, teachers, students, addGroup, updateGroup, deleteGroup, moveStudentToGroup } = useApp();
  const c = theme.colors;
  const teacherName = (id) => teachers.find(tc => tc.id === id)?.name || "—";
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, teacherId: teachers[0]?.id || "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [rosterOpenId, setRosterOpenId] = useState(null);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addGroup({ ...form });
    setForm({ ...emptyForm, teacherId: teachers[0]?.id || "" });
    setFormOpen(false);
  };

  const startEdit = (g) => {
    setEditingId(g.id);
    setEditForm({ name: g.name, subject: g.subject, teacherId: g.teacherId, schedule: g.schedule });
  };
  const saveEdit = (groupId) => {
    if (!editForm.name.trim()) return;
    updateGroup(groupId, editForm);
    setEditingId(null);
  };
  const handleDelete = (groupId) => {
    deleteGroup(groupId);
    setConfirmDeleteId(null);
  };

  const toggleStudentInGroup = (studentId, groupId, isIn) => {
    moveStudentToGroup(studentId, isIn ? null : groupId);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary }}>{t("manageGroups")}</div>
        <button onClick={() => setFormOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} /> {t("addGroup")}
        </button>
      </div>

      {formOpen && (
        <div style={{ background: c.surface, borderRadius: 14, padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <input placeholder={t("groupName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <input placeholder={t("subject")} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
            {teachers.map(tc => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
          </select>
          <input placeholder={t("schedulePlaceholder")} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <Button onClick={handleAdd} style={{ alignSelf: "flex-start" }}>{t("save")}</Button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {groups.map(g => {
          const isEditing = editingId === g.id;
          if (isEditing) {
            return (
              <div key={g.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <input value={editForm.subject} onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <select value={editForm.teacherId} onChange={(e) => setEditForm({ ...editForm, teacherId: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
                  {teachers.map(tc => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                </select>
                <input value={editForm.schedule} onChange={(e) => setEditForm({ ...editForm, schedule: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => saveEdit(g.id)}>{t("save")}</Button>
                  <button onClick={() => setEditingId(null)} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 10, padding: "0 16px", fontSize: 13, cursor: "pointer" }}>{t("cancel")}</button>
                </div>
              </div>
            );
          }
          return (
            <div key={g.id} style={{ background: c.surface, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: c.textPrimary }}>{g.name}</div>
                  <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>{g.subject} · {g.schedule}</div>
                  <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>{teacherName(g.teacherId)}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => startEdit(g)} aria-label={t("edit")} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setConfirmDeleteId(g.id)} aria-label={t("delete")} style={{ border: "none", background: c.surfaceAlt, color: c.danger, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {confirmDeleteId === g.id && (
                <div style={{ marginTop: 10, background: c.surfaceAlt, borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 12, color: c.textPrimary, marginBottom: 8 }}>{t("confirmDeleteGroupBody")}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => handleDelete(g.id)} style={{ border: "none", background: c.danger, color: c.onAccent, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("confirmDelete")}</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: c.surface, color: c.textSecondary, borderRadius: 8, padding: "6px 12px", fontSize: 11.5, cursor: "pointer" }}>{t("cancel")}</button>
                  </div>
                </div>
              )}

              <button onClick={() => setRosterOpenId(rosterOpenId === g.id ? null : g.id)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: c.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 10, padding: 0 }}>
                <Users size={13} /> {t("studentsCount", { count: g.studentIds.length })}
              </button>

              {rosterOpenId === g.id && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {students.map(s => {
                    const isIn = s.groupId === g.id;
                    return (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: c.textPrimary, background: c.surfaceAlt, borderRadius: 6, padding: "6px 10px", cursor: "pointer" }}>
                        <input type="checkbox" checked={isIn} onChange={() => toggleStudentInGroup(s.id, g.id, isIn)} />
                        {s.name}
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
