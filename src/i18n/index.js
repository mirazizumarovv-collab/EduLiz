import en from "./en.js";
import ru from "./ru.js";
import uz from "./uz.js";
import parentEn from "../parent-app/i18n/en.js";
import parentRu from "../parent-app/i18n/ru.js";
import parentUz from "../parent-app/i18n/uz.js";

export const dictionaries = {
  en: { ...en, ...parentEn },
  ru: { ...ru, ...parentRu },
  uz: { ...uz, ...parentUz },
};
export const SUPPORTED_LANGUAGES = [
  { id: "uz", label: "O'zbekcha" },
  { id: "ru", label: "Русский" },
  { id: "en", label: "English" },
];

// Simple {placeholder} interpolation — no external i18n library needed for
// an app this size, but the dictionary-per-file structure means swapping in
// a proper library (i18next, etc.) later only touches this file.
export function translate(lang, key, vars = {}) {
  const dict = dictionaries[lang] || dictionaries.en;
  let str = dict[key] ?? dictionaries.en[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => {
    str = str.replaceAll(`{${k}}`, v);
  });
  return str;
}
