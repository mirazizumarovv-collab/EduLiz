import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { attendanceService, gradeService, homeworkService } from "../services/index.js";
import { Section, Row, Button, StatPill } from "../components/common/UI.jsx";
import { LoadingSkeleton, ErrorState } from "../components/common/Feedback.jsx";
import { CURRENT_MONTH } from "../constants/months.js";
import { attendanceRate, homeworkStats, scoreColor } from "../utils/calculations.js";
import { subj } from "../utils/subjectNames.js";

export default function Profile({ onNavigate }) {
  const { t, lang, theme, studentList, selectedStudent, selectedStudentId, setSelectedStudentId } = useApp();
  const c = theme.colors;

  const attendanceQ = useAsyncData(() => attendanceService.get(selectedStudent.id), [selectedStudent.id]);
  const gradesQ = useAsyncData(() => gradeService.get(selectedStudent.id), [selectedStudent.id]);
  const homeworkQ = useAsyncData(() => homeworkService.get(selectedStudent.id), [selectedStudent.id]);
  const loading = attendanceQ.loading || gradesQ.loading || homeworkQ.loading;
  const error = attendanceQ.error || gradesQ.error || homeworkQ.error;

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: c.textPrimary }}>{t("profile")}</div>

      <Section title={t("sectionAccount")}>
        <Row label={t("profile")} value="Dilnoza A." />
        <Row label={t("phoneNumber")} value="+998 90 123 45 67" />
      </Section>

      {!loading && !error && (() => {
        const monthDays = attendanceQ.data[CURRENT_MONTH];
        const rate = attendanceRate(monthDays);
        const subjects = gradesQ.data;
        const overallAvg = subjects.length > 0 ? Math.round(subjects.reduce((a, s) => a + s.score, 0) / subjects.length) : null;
        const strongest = subjects.length > 0 ? subjects.reduce((a, b) => (b.score > a.score ? b : a)) : null;
        const hwStats = homeworkStats(homeworkQ.data.pending, homeworkQ.data.history);

        return (
          <>
            <Section title={t("quickSummary")}>
              <div style={{ fontSize: 12.5, color: c.textPrimary, background: c.surfaceAlt, borderRadius: 10, padding: 14, lineHeight: 1.6 }}>
                {strongest
                  ? t("profileSummaryText", { name: selectedStudent.name, avg: overallAvg, rate: rate ?? "—", subject: subj(lang, strongest.name) })
                  : t("noGradesYet")}
              </div>
            </Section>

            <Section title={t("childOverview")}>
              <div style={{ display: "flex", gap: 8 }}>
                <StatPill value={rate !== null ? `${rate}%` : "—"} label={t("attendanceRate")} color={rate !== null ? scoreColor(theme, rate, [75, 90]) : theme.colors.textSecondary} />
                <StatPill value={overallAvg !== null ? `${overallAvg}%` : "—"} label={t("currentAverage")} color={overallAvg !== null ? scoreColor(theme, overallAvg) : theme.colors.textSecondary} />
                <StatPill value={`${hwStats.completionRate}%`} label={t("completionRate")} color={scoreColor(theme, hwStats.completionRate, [60, 85])} />
              </div>
            </Section>
          </>
        );
      })()}

      <Section title={t("connectedChildren")}>
        {studentList.map(s => (
          <Row
            key={s.id}
            label={s.name}
            sub={s.grade}
            tone={s.id === selectedStudentId ? "highlight" : "normal"}
            onClick={() => setSelectedStudentId(s.id)}
          />
        ))}
        <Button variant="ghost" onClick={() => onNavigate("connectChild")} style={{ width: "100%", marginTop: 6 }}>
          {t("connectAnotherChild")}
        </Button>
      </Section>
    </div>
  );
}
