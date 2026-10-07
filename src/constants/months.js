// Month names for display, keyed by the three-letter abbreviation the monthly
// views use internally. All twelve months: the reporting window rolls with the
// real calendar (see utils/clock.js), so any month can be in it.
//
// "What is today" and "which months are in view" are NOT constants here any
// more — they come from the clock (utils/clock.js), which reads the real time.
export const MONTH_NAMES = {
  en: { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" },
  ru: { Jan: "Январь", Feb: "Февраль", Mar: "Март", Apr: "Апрель", May: "Май", Jun: "Июнь", Jul: "Июль", Aug: "Август", Sep: "Сентябрь", Oct: "Октябрь", Nov: "Ноябрь", Dec: "Декабрь" },
  uz: { Jan: "Yanvar", Feb: "Fevral", Mar: "Mart", Apr: "Aprel", May: "May", Jun: "Iyun", Jul: "Iyul", Aug: "Avgust", Sep: "Sentyabr", Oct: "Oktyabr", Nov: "Noyabr", Dec: "Dekabr" },
};

export const LOCALE_MAP = { en: "en-US", ru: "ru-RU", uz: "uz-UZ" };
