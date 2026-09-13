// The app's "current month" for demo/mock purposes. In a real backend this
// would simply be derived from the server clock — kept as one constant here
// so swapping to live data later means changing this in one place.
export const CURRENT_MONTH = "Sep";
export const CURRENT_DAY = 8;
export const CURRENT_DATE_STR = "2026-09-08";
export const CURRENT_TIME_STR = "14:30";

export const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];

export const MONTH_NAMES = {
  en: { Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September" },
  ru: { Mar: "Март", Apr: "Апрель", May: "Май", Jun: "Июнь", Jul: "Июль", Aug: "Август", Sep: "Сентябрь" },
  uz: { Mar: "Mart", Apr: "Aprel", May: "May", Jun: "Iyun", Jul: "Iyul", Aug: "Avgust", Sep: "Sentyabr" },
};

export const LOCALE_MAP = { en: "en-US", ru: "ru-RU", uz: "uz-UZ" };
