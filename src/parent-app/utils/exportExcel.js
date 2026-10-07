import * as XLSX from "xlsx";
import { getAttendance } from "../data/attendance.js";
import { getGrades, computeSubjectDerived } from "../data/grades.js";
import { getHomework } from "../data/homework.js";
import { getPayments } from "../data/payments.js";
import { MONTH_NAMES } from "../constants/months.js";
import { getMonths } from "../../utils/clock.js";
import { bridgeToday } from "../data/liveBridge.js";
import { attendanceRate, longestPresentStreak, recentLateCount, groupComparisonLabel } from "./calculations.js";
import { computeParentAnalytics } from "./parentAnalytics.js";

const STATUS_UZ = { P: "Keldi", L: "Kechikdi", A: "Kelmadi" };
const HW_STATUS_UZ = { completed: "Bajarildi", overdue: "Kechiktirildi", pending: "Kutilmoqda" };
const MONTH_NUM = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const hwStatusLabel = (h) => (h.status === "completed" && h.onTime === false ? "Kech topshirildi" : (HW_STATUS_UZ[h.status] || h.status));
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
  const today = bridgeToday();
  const todayStr = `${today.slice(8, 10)}.${today.slice(5, 7)}.${today.slice(0, 4)}`; // dd.mm.yyyy, from the date text itself
  const months = getMonths(today);                                                  // the months in view, oldest first
  const subtitle = `${student.name} · ${student.grade} · ${student.group} · Hisobot sanasi: ${todayStr}`;

  const attendanceData = getAttendance(student.id);
  const grades = getGrades(student.id).map(computeSubjectDerived);
  const homework = getHomework(student.id);
  const payments = getPayments(student.id);

  const streak = longestPresentStreak(attendanceData);
  const lateRecent = recentLateCount(attendanceData);
  const totalPaid = payments.history.reduce((sum, h) => sum + h.amount, 0);

  // Single shared source of truth — identical numbers to Insights and PrintableReport.
  const a = computeParentAnalytics({ studentId: student.id, grades, attendanceData, homework, today });
  const mnUz = (key) => MONTH_NAMES.uz[key] || key;

  const attPctOrNoData = (v) => (v !== null ? `${v}%` : "ma'lumot yo'q");

  const classAvgOrNoData = (s) => (s.hasClassComparison ? `${s.classAvg}%` : "ma'lumot yo'q");

  // The summary sheet narrates grade trends specifically, so it only makes
  // sense once there's at least one real assessment — the student still
  // gets Attendance/Homework/Payments sheets below either way.
  if (a.hasGrades) {
    const conclusion = `${student.name}ning umumiy o'quv ko'rsatkichi ${mnUz(a.firstGradeMonth)}dagi ${a.overallFirst}%dan ${mnUz(a.lastGradeMonth)}dagi ${a.overallLast}%ga ${a.overallDeltaSinceFirst >= 0 ? "oshdi" : "pasaydi"} ` +
      `(${a.overallDeltaSinceFirst >= 0 ? "+" : ""}${a.overallDeltaSinceFirst}%). ${a.strongest.name} eng kuchli fan (${a.strongest.score}%), ${a.needsAttention.name} esa eng ko'p e'tibor talab qiladi ` +
      `(${a.needsAttention.score}%, guruh o'rtachasi ${classAvgOrNoData(a.needsAttention)}). Davomat ${mnUz(a.attByMonth[0]?.month || a.firstGradeMonth)}dagi ${attPctOrNoData(a.attFirst)}dan ${mnUz(a.lastGradeMonth)}dagi ${attPctOrNoData(a.attLast)}ga o'zgardi.`;

    const recommendations = [];
    grades.forEach(s => {
      if (s.hasClassComparison && s.score - s.classAvg < -3) recommendations.push(`${s.name} fanini birga ko'rib chiqing — hozirda ${s.score}%, guruh o'rtachasi ${s.classAvg}%dan past.`);
    });
    if (lateRecent >= 2) recommendations.push(`So'nggi 14 ta darsda ${lateRecent} marta kechikish qayd etildi — sababini tekshirib ko'ring.`);
    if (a.hwStatsOverall.onTimeRate < 85) recommendations.push(`Uy vazifasini o'z vaqtida topshirish darajasi ${a.hwStatsOverall.onTimeRate}% — kunlik aniq vaqt ajratib qo'yish tavsiya etiladi.`);
    if (recommendations.length === 0) recommendations.push(`${student.name} davomat, baholar va uy vazifasi bo'yicha barqaror — shu tartibni davom ettiring.`);

    addSheet(wb, "Umumiy", "O'quvchi taraqqiyoti — umumiy hisobot", subtitle,
      ["Ko'rsatkich", "Qiymat", "Izoh"],
      [
        ["Umumiy ko'rsatkich", `${a.overallScore}/100`, `${mnUz(a.firstGradeMonth)}dan buyon ${a.overallDeltaSinceFirst >= 0 ? "+" : ""}${a.overallDeltaSinceFirst}%`],
        ["Davomat foizi (shu oy)", attPctOrNoData(a.attLast), a.attLast !== null ? `O'tgan oyga nisbatan ${a.attMoMDelta >= 0 ? "+" : ""}${a.attMoMDelta}%` : ""],
        ["Eng uzun davomat ketma-ketligi", `${streak} ta dars`, "Butun o'quv davri bo'yicha"],
        ["So'nggi 14 ta darsda kechikishlar", `${lateRecent} marta`, lateRecent >= 2 ? "Diqqat talab qiladi" : "Muammo yo'q"],
        ["Uy vazifasi bajarilish foizi", `${a.hwStatsOverall.completionRate}%`, `Jami ${a.hwStatsOverall.total} ta topshiriq`],
        ["Uy vazifasi o'z vaqtida bajarilishi", `${a.hwStatsOverall.onTimeRate}%`, `O'tgan oyga nisbatan ${a.hwMoMDelta >= 0 ? "+" : ""}${a.hwMoMDelta}%`],
        ["Eng kuchli fan", a.strongest.name, `${a.strongest.score}% (${mnUz(a.firstGradeMonth)}dan ${a.strongest.delta >= 0 ? "+" : ""}${a.strongest.delta}%)`],
        ["E'tibor talab qiladigan fan", a.needsAttention.name, `${a.needsAttention.score}% (guruh o'rtachasi ${classAvgOrNoData(a.needsAttention)})`],
        ["Qayd etilgan jami to'lov", `${totalPaid.toLocaleString()} ${payments.currency}`, `${payments.history.length} oy davomida`],
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
  } else {
    addSheet(wb, "Umumiy", "O'quvchi taraqqiyoti — umumiy hisobot", subtitle,
      ["Ko'rsatkich", "Qiymat", "Izoh"],
      [["Baholar", "Hali baholanmagan", "Birinchi baho qo'yilgach umumiy tahlil shu yerda chiqadi"]],
      [34, 50, 40]
    );
  }

  const subjectRows = grades.map(s => {
    const cmp = groupComparisonLabel(s.score, s.classAvg, s.hasClassComparison);
    return [s.name, `${s.score}%`, trendArrow(s.monthTrend), s.hasClassComparison ? `${s.classAvg}%` : "—", cmp.key, `${MONTH_NAMES.uz[s.best.month]} (${s.best.score})`, `${MONTH_NAMES.uz[s.worst.month]} (${s.worst.score})`];
  });
  addSheet(wb, "Fanlar", "Fanlar bo'yicha taraqqiyot", subtitle,
    ["Fan", "Joriy ball", "Oylik o'zgarish", "Guruh o'rtachasi", "Solishtirma", "Eng yaxshi oy", "Eng past oy"],
    subjectRows, [16, 12, 16, 16, 20, 20, 20]
  );

  const attendanceRows = months.flatMap(m =>
    (attendanceData[m] || []).map(d => [MONTH_NAMES.uz[m] || m, d.day, d.subject, d.teacher, d.time, d.topic, STATUS_UZ[d.status], d.lateBy || "", d.checkIn || "", d.checkedInBy || ""])
  );
  addSheet(wb, "Davomat", `Davomat — kunlik jurnal (${MONTH_NAMES.uz[months[0]]}–${MONTH_NAMES.uz[months[months.length - 1]]})`, subtitle,
    ["Oy", "Kun", "Fan", "O'qituvchi", "Vaqt", "Mavzu", "Holat", "Kechikish (daq.)", "Kelgan vaqti", "Qayd etdi"],
    attendanceRows, [10, 6, 14, 18, 14, 26, 12, 14, 12, 16]
  );

  // getGrades() starts every subject's monthly series at the first month with
  // a real assessment, so the month columns must come from that data — not
  // from the fixed Mar–Sep list — and each cell is looked up BY MONTH NAME
  // rather than by position, so a header and the cells beneath it can never
  // disagree about which month they mean.
  const gradeMonths = months.filter(mo => grades.some(s => s.monthly.some(x => x.month === mo)));
  const gradeRows = grades.map(s => [
    s.name, `${s.score}%`, s.hasClassComparison ? `${s.classAvg}%` : "—",
    ...gradeMonths.map(mo => {
      const cell = s.monthly.find(x => x.month === mo);
      return cell && cell.real ? cell.score : "—";
    }),
  ]);
  addSheet(wb, "Baholar", "Baholar — oylar bo'yicha", subtitle,
    ["Fan", "Joriy ball", "Guruh o'rtachasi", ...gradeMonths.map(mo => MONTH_NAMES.uz[mo] || mo)],
    gradeRows, [16, 12, 16, ...gradeMonths.map(() => 8)]
  );

  const hwRows = [...homework.history, ...homework.pending]
    .sort((a, b) => MONTH_NUM[a.month] - MONTH_NUM[b.month] || a.day - b.day)
    .map(h => [MONTH_NAMES.uz[h.month] || h.month, h.day || "", h.title, h.subject, hwStatusLabel(h)]);
  addSheet(wb, "Uy vazifasi", "Uy vazifasi — to'liq tarix", subtitle,
    ["Oy", "Kun", "Nomi", "Fan", "Holat"], hwRows, [12, 8, 32, 16, 16]
  );

  const paymentRows = payments.history.map(h => [`${h.month} ${h.year}`, `${h.amount.toLocaleString()} ${payments.currency}`, h.paidOn]);
  addSheet(wb, "To'lov", "To'lovlar tarixi", subtitle,
    ["Oy", "Summa", "To'langan sana"], paymentRows, [16, 20, 18]
  );

  XLSX.writeFile(wb, `${student.name.replace(/\s+/g, "_")}_hisobot.xlsx`);
}
