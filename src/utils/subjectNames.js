// Mock/real data stores canonical English subject keys (e.g. "Mathematics")
// so they match consistently regardless of app language. This is the single
// place that translates them for display.
const SUBJECT_NAMES = {
  en: { Mathematics: "Mathematics", English: "English", Science: "Science", Reading: "Reading" },
  ru: { Mathematics: "Математика", English: "Английский", Science: "Естествознание", Reading: "Чтение" },
  uz: { Mathematics: "Matematika", English: "Ingliz tili", Science: "Tabiiy fanlar", Reading: "O'qish" },
};

export function subj(lang, key) {
  return (SUBJECT_NAMES[lang] && SUBJECT_NAMES[lang][key]) || key;
}
