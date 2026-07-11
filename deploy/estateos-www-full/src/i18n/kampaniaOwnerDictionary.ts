import type { Locale } from "./config";

export type KampaniaOwnerDictionary = {
  pageTitle: string;
  pageSubtitle: string;
  progressLabel: string;
  copyDone: string;
  copyTodo: string;
  appSection: string;
  appBody: string;
};

const pl: KampaniaOwnerDictionary = {
  pageTitle: "Twój plan kampanii",
  pageSubtitle: "Minimalna lista zadań właściciela EstateOS. Reszta jest już wdrożona na estateos.pl.",
  progressLabel: "Postęp checklisty",
  copyDone: "Skopiowano!",
  copyTodo: "Kopiuj",
  appSection: "Aplikacja w materiałach",
  appBody: "Linki do App Store i kampanii — gotowe do wklejenia w posty i maile.",
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
};

export function getKampaniaOwnerDictionary(locale: Locale): KampaniaOwnerDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
