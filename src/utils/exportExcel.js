import * as XLSX from "xlsx";
import { getAttendance } from "../data/attendance.js";
import { getGrades, computeSubjectDerived } from "../data/grades.js";
import { getHomework } from "../data/homework.js";
import { getPayments } from "../data/payments.js";
import { MONTHS, MONTH_NAMES, CURRENT_MONTH, CURRENT_DATE_STR } from "../constants/months.js";
import { attendanceRate, longestPresentStreak, recentLateCount, groupComparisonLabel } from "./calculations.js";
import { computeParentAnalytics } from "./parentAnalytics.js";

const STATUS_UZ = { P: "Keldi", L: "Kechikdi", A: "Kelmadi" };
const HW_STATUS_UZ = { completed: "Bajarildi", overdue: "Kechiktirildi", pending: "Kutilmoqda" };
const trendArrow = (delta) => (delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "→ 0");

function addSheet(wb, sheetName, title, subtitle, headerRow, dataRows, colWidths) {
  const aoa = [[title], [subtitle], [], headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const lastCol = headerRow.length - 1;
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } }, { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } }];
  ws["!cols"] = colWidths.map(w => ({ wch: w }));
  if (dataRows.length > 0) {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + dataRows.length, c: lastCol } }) };
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
}

export function exportChildDataToExcel(student) {
  const wb = XLSX.utils.book_new();
  const todayStr = new Date(CURRENT_DATE_STR).toLocaleDateString("uz-UZ");
  const subtitle = `${student.name} · ${student.grade} · ${student.group} · Hisobot sanasi: ${todayStr}`;

  const attendanceData = getAttendance(student.id);
  const grades = getGrades(student.id).map(computeSubjectDerived);
  const homework = getHomework(student.id);
  const payments = getPayments(student.id);

  const monthDays = attendanceData[CURRENT_MONTH];
  const streak = longestPresentStreak(attendanceData);
  const lateRecent = recentLateCount(monthDays);
  const totalPaid = payments.history.reduce((sum, h) => sum + h.amount, 0);

  // Single shared source of truth — identical numbers to Insights and PrintableReport.
  const a = computeParentAnalytics({ studentId: student.id, grades, attendanceData, homework });
  const mnUz = (key) => MONTH_NAMES.uz[key] || key;

  const attPctOrNoData = (v) => (v !== null ? `${v}%` : "ma'lumot yo'q");

  const conclusion = `${student.name}ning umumiy o'quv ko'rsatkichi ${mnUz(a.firstGradeMonth)}dagi ${a.overallFirst}%dan ${mnUz(a.lastGradeMonth)}dagi ${a.overallLast}%ga ${a.overallDeltaSinceFirst >= 0 ? "oshdi" : "pasaydi"} ` +
    `(${a.overallDeltaSinceFirst >= 0 ? "+" : ""}${a.overallDeltaSinceFirst}%). ${a.strongest.name} eng kuchli fan (${a.strongest.score}%), ${a.needsAttention.name} esa eng ko'p e'tibor talab qiladi ` +
    `(${a.needsAttention.score}%, guruh o'rtachasi ${a.needsAttention.classAvg}%). Davomat ${mnUz(a.attByMonth[0].month)}dagi ${attPctOrNoData(a.attFirst)}dan ${mnUz(a.lastGradeMonth)}dagi ${attPctOrNoData(a.attLast)}ga o'zgardi.`;

  const recommendations = [];
  grades.forEach(s => {
    if (s.score - s.classAvg < -3) recommendations.push(`${s.name} fanini birga ko'rib chiqing — hozirda ${s.score}%, guruh o'rtachasi ${s.classAvg}%dan past.`);
  });
  if (lateRecent >= 2) recommendations.push(`So'nggi 14 kunda ${lateRecent} marta kechikish qayd etildi — sababini tekshirib ko'ring.`);
  if (a.hwStatsOverall.onTimeRate < 85) recommendations.push(`Uy vazifasini o'z vaqtida topshirish darajasi ${a.hwStatsOverall.onTimeRate}% — kunlik aniq vaqt ajratib qo'yish tavsiya etiladi.`);
  if (recommendations.length === 0) recommendations.push(`${student.name} davomat, baholar va uy vazifasi bo'yicha barqaror — shu tartibni davom ettiring.`);

  addSheet(wb, "Umumiy", "O'quvchi taraqqiyoti — umumiy hisobot", subtitle,
    ["Ko'rsatkich", "Qiymat", "Izoh"],
    [
      ["Umumiy ko'rsatkich", `${a.overallScore}/100`, `${mnUz(a.firstGradeMonth)}dan buyon ${a.overallDeltaSinceFirst >= 0 ? "+" : ""}${a.overallDeltaSinceFirst}%`],
      ["Davomat foizi (shu oy)", attPctOrNoData(a.attLast), a.attLast !== null ? `O'tgan oyga nisbatan ${a.attMoMDelta >= 0 ? "+" : ""}${a.attMoMDelta}%` : ""],
      ["Eng uzun davomat ketma-ketligi", `${streak} kun`, "Butun o'quv davri bo'yicha"],
      ["So'nggi 14 kunda kechikishlar", `${lateRecent} marta`, lateRecent >= 2 ? "Diqqat talab qiladi" : "Muammo yo'q"],
      ["Uy vazifasi bajarilish foizi", `${a.hwStatsOverall.completionRate}%`, `Jami ${a.hwStatsOverall.total} ta topshiriq`],
      ["Uy vazifasi o'z vaqtida bajarilishi", `${a.hwStatsOverall.onTimeRate}%`, `O'tgan oyga nisbatan ${a.hwMoMDelta >= 0 ? "+" : ""}${a.hwMoMDelta}%`],
      ["Eng kuchli fan", a.strongest.name, `${a.strongest.score}% (${mnUz(a.firstGradeMonth)}dan ${a.strongest.delta >= 0 ? "+" : ""}${a.strongest.delta}%)`],
      ["E'tibor talab qiladigan fan", a.needsAttention.name, `${a.needsAttention.score}% (guruh o'rtachasi ${a.needsAttention.classAvg}%)`],
      ["Shu yil to'langan jami to'lov", `${totalPaid.toLocaleString()} ${payments.currency}`, `${payments.history.length} oy davomida`],
      ["", "", ""],
      ["Oylik solishtiruv", mnUz(a.attByMonth[a.attByMonth.length - 2]?.month || a.firstGradeMonth), mnUz(a.lastGradeMonth)],
      ["  Umumiy o'rtacha", `${a.overallPrevMonth}%`, `${a.overallLast}% (${a.overallMoMDelta >= 0 ? "+" : ""}${a.overallMoMDelta}%)`],
      ["  Davomat", attPctOrNoData(a.attPrevMonth), `${attPctOrNoData(a.attLast)} (${a.attMoMDelta >= 0 ? "+" : ""}${a.attMoMDelta}%)`],
      ["  Uy vazifasi", `${a.hwPrevMonthPct}%`, `${a.hwCurrentMonthPct}% (${a.hwMoMDelta >= 0 ? "+" : ""}${a.hwMoMDelta}%)`],
      ["", "", ""],
      ["Xulosa", conclusion, ""],
      ["", "", ""],
      ["Tavsiyalar", "", ""],
      ...recommendations.map((r, i) => [`  ${i + 1}.`, r, ""]),
    ],
    [34, 50, 40]
  );

  const subjectRows = grades.map(s => {
    const cmp = groupComparisonLabel(s.score, s.classAvg);
    return [s.name, `${s.score}%`, trendArrow(s.monthTrend), `${s.classAvg}%`, cmp.key, `${MONTH_NAMES.uz[s.best.month]} (${s.best.score})`, `${MONTH_NAMES.uz[s.worst.month]} (${s.worst.score})`];
  });
  addSheet(wb, "Fanlar", "Fanlar bo'yicha taraqqiyot", subtitle,
    ["Fan", "Joriy ball", "Oylik o'zgarish", "Guruh o'rtachasi", "Solishtirma", "Eng yaxshi oy", "Eng past oy"],
    subjectRows, [16, 12, 16, 16, 20, 20, 20]
  );

  const attendanceRows = MONTHS.flatMap(m =>
    (attendanceData[m] || []).map(d => [MONTH_NAMES.uz[m] || m, d.day, d.subject, d.teacher, d.time, d.topic, STATUS_UZ[d.status], d.lateBy || "", d.checkIn || "", d.checkedInBy || ""])
  );
  addSheet(wb, "Davomat", "Davomat — kunlik jurnal (Mart–Sentyabr)", subtitle,
    ["Oy", "Kun", "Fan", "O'qituvchi", "Vaqt", "Mavzu", "Holat", "Kechikish (daq.)", "Kelgan vaqti", "Qayd etdi"],
    attendanceRows, [10, 6, 14, 18, 14, 26, 12, 14, 12, 16]
  );

  const gradeRows = grades.map(s => [s.name, `${s.score}%`, `${s.classAvg}%`, ...s.monthly.map(m => m.score)]);
  addSheet(wb, "Baholar", "Baholar — oylar bo'yicha", subtitle,
    ["Fan", "Joriy ball", "Guruh o'rtachasi", ...MONTHS.map(m => MONTH_NAMES.uz[m])],
    gradeRows, [16, 12, 16, 8, 8, 8, 8, 8, 8, 10]
  );

  const hwRows = [...homework.history, ...homework.pending]
    .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month) || a.day - b.day)
    .map(h => [MONTH_NAMES.uz[h.month] || h.month, h.day || "", h.title, h.subject, HW_STATUS_UZ[h.status] || h.status]);
  addSheet(wb, "Uy vazifasi", "Uy vazifasi — to'liq tarix", subtitle,
    ["Oy", "Kun", "Nomi", "Fan", "Holat"], hwRows, [12, 8, 32, 16, 16]
  );

  const paymentRows = payments.history.map(h => [h.month, `${h.amount.toLocaleString()} ${payments.currency}`, h.paidOn]);
  addSheet(wb, "To'lov", "To'lovlar tarixi", subtitle,
    ["Oy", "Summa", "To'langan sana"], paymentRows, [16, 20, 18]
  );

  XLSX.writeFile(wb, `${student.name.replace(/\s+/g, "_")}_hisobot.xlsx`);
}
