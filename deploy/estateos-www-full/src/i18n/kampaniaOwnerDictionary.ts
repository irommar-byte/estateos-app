import type { Locale } from "./config";

export type KampaniaOwnerDictionary = {
  pageTitle: string;
  pageSubtitle: string;
  progressLabel: string;
  copyDone: string;
  copyTodo: string;
  appSection: string;
  appBody: string;
  eyebrow: string;
  mainTitle: string;
  introSteps: string;
  introMinutes: string;
  introRemaining: string;
  introCompleted: string;
  bookmarksTitle: string;
  bookmarksIntro: string;
  bookmark1: string;
  bookmark2: string;
  bookmark3: string;
  safariMac: string;
  safariIos: string;
  doneSectionTitle: string;
  stepMeta: string;
  markDone: string;
  markUndone: string;
  week2Title: string;
  week2Items: string[];
  pressKitLink: string;
  startLink: string;
};

const pl: KampaniaOwnerDictionary = {
  pageTitle: "Twój plan kampanii",
  pageSubtitle: "Minimalna lista zadań właściciela EstateOS. Reszta jest już wdrożona na estateos.pl.",
  progressLabel: "Postęp checklisty",
  copyDone: "Skopiowano!",
  copyTodo: "Kopiuj",
  appSection: "Aplikacja w materiałach",
  appBody: "Linki do App Store i kampanii — gotowe do wklejenia w posty i maile.",
  eyebrow: "Twój plan",
  mainTitle: "Kampania EstateOS — tylko to, czego nie zrobię za Ciebie",
  introSteps: "7 kroków",
  introMinutes: "min",
  introRemaining: "Zostało:",
  introCompleted: "ukończone",
  bookmarksTitle: "Zakładki w przeglądarce — co zapisać i gdzie",
  bookmarksIntro: "Zapisz 3 adresy w folderze „EstateOS”:",
  bookmark1: "Twój plan (codziennie stąd zaczynasz):",
  bookmark2: "Gotowe teksty do postów:",
  bookmark3: "Link do udostępniania innym:",
  safariMac: "Safari na Macu:",
  safariIos: "iPhone / iPad (Safari):",
  doneSectionTitle: "Już zrobione (system / agent)",
  stepMeta: "krok",
  markDone: "Oznacz jako ukończone",
  markUndone: "Oznacz jako nieukończone",
  week2Title: "Po tygodniu 1 — minimum na co dzień (15 min)",
  week2Items: [
    "1 post lub komentarz z linkiem UTM (teksty: /dla-prasy)",
    "Odpowiedz na wiadomości / maile od agencji",
    "Raz w tygodniu: sprawdź Centralę → statystyki odwiedzin",
  ],
  pressKitLink: "Press kit →",
  startLink: "Strona /start →",
};

const en: KampaniaOwnerDictionary = {
  ...pl,
  pageTitle: "Your campaign plan",
  pageSubtitle: "Minimal owner checklist for EstateOS. The rest is already live on estateos.pl.",
  progressLabel: "Checklist progress",
  copyDone: "Copied!",
  copyTodo: "Copy",
  appSection: "App in materials",
  appBody: "App Store and campaign links — ready to paste in posts and emails.",
  eyebrow: "Your plan",
  mainTitle: "EstateOS campaign — only what we cannot do for you",
  introSteps: "7 steps",
  introMinutes: "min",
  introRemaining: "Remaining:",
  introCompleted: "completed",
  bookmarksTitle: "Browser bookmarks — what to save",
  bookmarksIntro: "Save 3 URLs w folderze „EstateOS”:",
  bookmark1: "Your plan (codziennie stąd zaczynasz):",
  bookmark2: "Ready post texts:",
  bookmark3: "Share link for others:",
  safariMac: "Safari on Mac:",
  safariIos: "iPhone / iPad (Safari):",
  doneSectionTitle: "Already done (system / agent)",
  stepMeta: "step",
  markDone: "Oznacz jako completed",
  markUndone: "Oznacz jako niecompleted",
  week2Title: "After week 1 — daily minimum (15 min)",
  week2Items: [
    "1 post lub komentarz z linkiem UTM (teksty: /dla-prasy)",
    "Odpowiedz na wiadomości / maile od agencji",
    "Raz w tygodniu: sprawdź Centralę → statystyki odwiedzin",
  ],
  pressKitLink: "Press kit →",
  startLink: "/start page →",
};

const uk: KampaniaOwnerDictionary = {
  ...en,
  pageTitle: "Ваш план кампанії",
  pageSubtitle: "Мінімальний чекліст власника EstateOS. Решта вже на estateos.pl.",
  progressLabel: "Прогрес чекліста",
  copyDone: "Скопійовано!",
  copyTodo: "Копіювати",
  appSection: "Застосунок у матеріалах",
  appBody: "Посилання App Store та кампанії — готові для постів і листів.",
  eyebrow: "Ваш план",
  mainTitle: "Кампанія EstateOS — лише те, що я не зроблю за вас",
  introSteps: "7 кроків",
  introMinutes: "хв",
  introRemaining: "Залишилось:",
  introCompleted: "завершено",
  bookmarksTitle: "Закладки в браузері — що зберегти",
  bookmarksIntro: "Збережіть 3 адреси в папці «EstateOS»:",
  bookmark1: "Ваш план (починайте тут щодня):",
  bookmark2: "Готові тексти для постів:",
  bookmark3: "Посилання для поширення:",
  safariMac: "Safari на Mac:",
  safariIos: "iPhone / iPad (Safari):",
  doneSectionTitle: "Вже зроблено (система / агент)",
  stepMeta: "крок",
  markDone: "Позначити виконаним",
  markUndone: "Позначити невиконаним",
  week2Title: "Після тижня 1 — щоденний мінімум (15 хв)",
  week2Items: [
    "1 пост або коментар з UTM (тексти: /dla-prasy)",
    "Відповіді на повідомлення / листи від агентств",
    "Раз на тиждень: Centrala → статистика відвідувань",
  ],
  pressKitLink: "Press kit →",
  startLink: "Сторінка /start →",
};

export function getKampaniaOwnerDictionary(locale: Locale): KampaniaOwnerDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
