import React, { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";

export default function ManageTeachers() {
  const { t, theme, teachers, groups, addTeacher, updateTeacher, deleteTeacher } = useApp();
  const c = theme.colors;
  const groupsFor = (teacherId) => groups.filter(g => g.teacherId === teacherId).map(g => g.name).join(", ");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", subjects: "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", subjects: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addTeacher({ name: form.name, phone: form.phone, subjects: form.subjects.split(",").map(s => s.trim()).filter(Boolean) });
    setForm({ name: "", phone: "", subjects: "" });
    setFormOpen(false);
  };

  const startEdit = (tc) => {
    setEditingId(tc.id);
    setEditForm({ name: tc.name, phone: tc.phone, subjects: tc.subjects.join(", ") });
  };
  const saveEdit = (teacherId) => {
    if (!editForm.name.trim()) return;
    updateTeacher(teacherId, { name: editForm.name, phone: editForm.phone, subjects: editForm.subjects.split(",").map(s => s.trim()).filter(Boolean) });
    setEditingId(null);
  };
  const handleDelete = (teacherId) => {
    deleteTeacher(teacherId);
    setConfirmDeleteId(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary }}>{t("manageTeachers")}</div>
        <button onClick={() => setFormOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} /> {t("addTeacher")}
        </button>
      </div>

      {formOpen && (
        <div style={{ background: c.surface, borderRadius: 14, padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <input placeholder={t("teacherName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <input placeholder={t("teacherPhone")} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <input placeholder={t("subjectsCommaSep")} value={form.subjects} onChange={(e) => setForm({ ...form, subjects: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <Button onClick={handleAdd} style={{ alignSelf: "flex-start" }}>{t("save")}</Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {teachers.map(tc => {
          const isEditing = editingId === tc.id;
          if (isEditing) {
            return (
              <div key={tc.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <input value={editForm.subjects} onChange={(e) => setEditForm({ ...editForm, subjects: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => saveEdit(tc.id)}>{t("save")}</Button>
                  <button onClick={() => setEditingId(null)} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 10, padding: "0 16px", fontSize: 13, cursor: "pointer" }}>{t("cancel")}</button>
                </div>
              </div>
            );
          }
          return (
            <div key={tc.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: c.textPrimary }}>{tc.name}</div>
                <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 4 }}>{tc.phone} · {tc.subjects.join(", ")}</div>
                <div style={{ fontSize: 12, color: c.accent, marginTop: 6 }}>{groupsFor(tc.id)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button onClick={() => startEdit(tc)} aria-label={t("edit")} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Pencil size={13} />
                </button>
                {confirmDeleteId === tc.id ? (
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => handleDelete(tc.id)} style={{ border: "none", background: c.danger, color: c.onAccent, borderRadius: 8, padding: "0 10px", height: 30, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("confirmDelete")}</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, padding: "0 10px", height: 30, fontSize: 11.5, cursor: "pointer" }}>{t("cancel")}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(tc.id)} aria-label={t("delete")} style={{ border: "none", background: c.surfaceAlt, color: c.danger, borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
