import React, { useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../../components/common/UI.jsx";

const emptyForm = { name: "", grade: "", groupId: "", guardianName: "", guardianPhone: "" };

export default function ManageStudents() {
  const { t, theme, students, groups, addStudent, updateStudent, deleteStudent, moveStudentToGroup } = useApp();
  const c = theme.colors;
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm, groupId: groups[0]?.id || "" });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const groupName = (id) => groups.find(g => g.id === id)?.name || "—";

  const handleAdd = () => {
    if (!form.name.trim()) return;
    addStudent({ ...form, connectionCode: `REG-${Math.floor(1000 + Math.random() * 9000)}` });
    setForm({ ...emptyForm, groupId: groups[0]?.id || "" });
    setFormOpen(false);
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, grade: s.grade, groupId: s.groupId, guardianName: s.guardianName, guardianPhone: s.guardianPhone });
  };
  const saveEdit = (studentId) => {
    if (!editForm.name.trim()) return;
    updateStudent(studentId, { name: editForm.name, grade: editForm.grade, guardianName: editForm.guardianName, guardianPhone: editForm.guardianPhone });
    const original = students.find(s => s.id === studentId);
    if (original && original.groupId !== editForm.groupId) moveStudentToGroup(studentId, editForm.groupId);
    setEditingId(null);
  };

  const handleDelete = (studentId) => {
    deleteStudent(studentId);
    setConfirmDeleteId(null);
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).catch(() => {});
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary }}>{t("manageStudents")}</div>
        <button onClick={() => setFormOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={15} /> {t("addStudent")}
        </button>
      </div>

      {formOpen && (
        <div style={{ background: c.surface, borderRadius: 14, padding: 18, marginBottom: 20, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
          <input placeholder={t("studentName")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <input placeholder={t("studentGrade")} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <select value={form.groupId} onChange={(e) => setForm({ ...form, groupId: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input placeholder={t("guardianName")} value={form.guardianName} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <input placeholder={t("guardianPhone")} value={form.guardianPhone} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "10px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
          <Button onClick={handleAdd} style={{ alignSelf: "flex-start" }}>{t("save")}</Button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {students.map(s => {
          const isEditing = editingId === s.id;
          if (isEditing) {
            return (
              <div key={s.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <input value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <select value={editForm.groupId} onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <input value={editForm.guardianName} onChange={(e) => setEditForm({ ...editForm, guardianName: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <input value={editForm.guardianPhone} onChange={(e) => setEditForm({ ...editForm, guardianPhone: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "9px 12px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 13 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button onClick={() => saveEdit(s.id)}>{t("save")}</Button>
                  <button onClick={() => setEditingId(null)} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 10, padding: "0 16px", fontSize: 13, cursor: "pointer" }}>{t("cancel")}</button>
                </div>
              </div>
            );
          }
          return (
            <div key={s.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.name} <span style={{ fontWeight: 400, color: c.textSecondary }}>· {s.grade}</span></div>
                <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{groupName(s.groupId)} · {s.guardianName} · {s.guardianPhone}</div>
                {s.connectionCode && (
                  <button onClick={() => copyCode(s.connectionCode)} style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, border: "none", background: c.surfaceAlt, color: c.accent, borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                    <Copy size={11} /> {s.connectionCode}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => startEdit(s)} aria-label={t("edit")} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Pencil size={14} />
                </button>
                {confirmDeleteId === s.id ? (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <button onClick={() => handleDelete(s.id)} style={{ border: "none", background: c.danger, color: c.onAccent, borderRadius: 8, padding: "0 10px", height: 32, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{t("confirmDelete")}</button>
                    <button onClick={() => setConfirmDeleteId(null)} style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, padding: "0 10px", height: 32, fontSize: 11.5, cursor: "pointer" }}>{t("cancel")}</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(s.id)} aria-label={t("delete")} style={{ border: "none", background: c.surfaceAlt, color: c.danger, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Trash2 size={14} />
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
