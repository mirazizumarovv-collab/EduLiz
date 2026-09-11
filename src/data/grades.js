const scoreTrendAisha = [
  { week: "Wk 1", score: 68 }, { week: "Wk 2", score: 71 }, { week: "Wk 3", score: 69 },
  { week: "Wk 4", score: 76 }, { week: "Wk 5", score: 74 }, { week: "Wk 6", score: 81 },
];

const gradesByStudent = {
  aisha: [
    {
      name: "Mathematics", score: 81, classAvg: 75, weeklyTrend: scoreTrendAisha,
      lastAssessment: { title: "Practice test 2", scoreRaw: "16/20", date: "Sep 6" },
      monthly: [
        { month: "Mar", score: 58 }, { month: "Apr", score: 63 }, { month: "May", score: 67 },
        { month: "Jun", score: 70 }, { month: "Jul", score: 74 }, { month: "Aug", score: 76 }, { month: "Sep", score: 81 },
      ],
    },
    {
      name: "English", score: 74, classAvg: 72, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 7 })),
      lastAssessment: { title: "Vocabulary list 9", scoreRaw: "18/20", date: "Sep 3" },
      monthly: [
        { month: "Mar", score: 55 }, { month: "Apr", score: 58 }, { month: "May", score: 61 },
        { month: "Jun", score: 64 }, { month: "Jul", score: 66 }, { month: "Aug", score: 70 }, { month: "Sep", score: 74 },
      ],
    },
    {
      name: "Science", score: 69, classAvg: 73, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 12 })),
      lastAssessment: { title: "Lab observation sheet", scoreRaw: "14/20", date: "Sep 2" },
      monthly: [
        { month: "Mar", score: 60 }, { month: "Apr", score: 62 }, { month: "May", score: 64 },
        { month: "Jun", score: 66 }, { month: "Jul", score: 65 }, { month: "Aug", score: 72 }, { month: "Sep", score: 69 },
      ],
    },
  ],
  umar: [
    {
      name: "Mathematics", score: 64, classAvg: 68, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 14 })),
      lastAssessment: { title: "Addition worksheet", scoreRaw: "13/20", date: "Sep 5" },
      monthly: [
        { month: "Mar", score: 56 },
        { month: "Apr", score: 58 }, { month: "May", score: 60 }, { month: "Jun", score: 61 }, { month: "Jul", score: 62 }, { month: "Aug", score: 63 }, { month: "Sep", score: 64 },
      ],
    },
    {
      name: "Reading", score: 71, classAvg: 66, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 8 })),
      lastAssessment: { title: "Story comprehension", scoreRaw: "17/20", date: "Sep 8" },
      monthly: [
        { month: "Mar", score: 60 },
        { month: "Apr", score: 62 }, { month: "May", score: 64 }, { month: "Jun", score: 66 }, { month: "Jul", score: 68 }, { month: "Aug", score: 70 }, { month: "Sep", score: 71 },
      ],
    },
  ],
  "aisha-friend-1": [
    {
      name: "Mathematics", score: 78, classAvg: 74, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 3 })),
      lastAssessment: { title: "Fractions quiz", scoreRaw: "17/20", date: "Sep 4" },
      monthly: [
        { month: "Mar", score: 62 }, { month: "Apr", score: 66 }, { month: "May", score: 69 },
        { month: "Jun", score: 71 }, { month: "Jul", score: 73 }, { month: "Aug", score: 76 }, { month: "Sep", score: 78 },
      ],
    },
    {
      name: "English", score: 80, classAvg: 75, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 1 })),
      lastAssessment: { title: "Grammar test", scoreRaw: "18/20", date: "Sep 7" },
      monthly: [
        { month: "Mar", score: 65 }, { month: "Apr", score: 68 }, { month: "May", score: 71 },
        { month: "Jun", score: 74 }, { month: "Jul", score: 76 }, { month: "Aug", score: 78 }, { month: "Sep", score: 80 },
      ],
    },
  ],
  "aisha-friend-2": [
    {
      name: "Mathematics", score: 70, classAvg: 72, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 10 })),
      lastAssessment: { title: "Geometry basics quiz", scoreRaw: "14/20", date: "Sep 6" },
      monthly: [
        { month: "Mar", score: 59 }, { month: "Apr", score: 61 }, { month: "May", score: 64 },
        { month: "Jun", score: 66 }, { month: "Jul", score: 67 }, { month: "Aug", score: 68 }, { month: "Sep", score: 70 },
      ],
    },
    {
      name: "Science", score: 73, classAvg: 71, weeklyTrend: scoreTrendAisha.map(d => ({ ...d, score: d.score - 6 })),
      lastAssessment: { title: "Plant biology worksheet", scoreRaw: "15/20", date: "Sep 3" },
      monthly: [
        { month: "Mar", score: 61 }, { month: "Apr", score: 63 }, { month: "May", score: 65 },
        { month: "Jun", score: 67 }, { month: "Jul", score: 69 }, { month: "Aug", score: 71 }, { month: "Sep", score: 73 },
      ],
    },
  ],
};

export function getGrades(studentId) {
  return gradesByStudent[studentId] || [];
}

export function computeSubjectDerived(subject) {
  const monthly = subject.monthly;
  const best = monthly.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = monthly.reduce((a, b) => (b.score < a.score ? b : a));
  const monthTrend = monthly[monthly.length - 1].score - monthly[monthly.length - 2].score;
  const weekTrend = subject.weeklyTrend[subject.weeklyTrend.length - 1].score - subject.weeklyTrend[subject.weeklyTrend.length - 2].score;
  return { ...subject, best, worst, monthTrend, weekTrend };
}
