import type { Locale } from "./config";

export type ContactInboxDictionary = {
  loading: string;
  eyebrow: string;
  title: string;
  back: string;
  add: string;
  noMessages: string;
  selectThread: string;
  threadAttachments: string;
  noAttachments: string;
  writePlaceholder: string;
  send: string;
  addAttachment: string;
  removeAttachment: string;
  removeThread: string;
  invalidFileType: string;
  attachmentLimit: string;
  sendFail: string;
  invalidUserId: string;
  cannotMessageSelf: string;
  findUserFail: string;
  deleteThreadConfirm: string;
  deleteThreadFail: string;
  deleteError: string;
};

const pl: ContactInboxDictionary = {
  loading: "Ładowanie wiadomości…",
  eyebrow: "EstateOS™ Contact",
  title: "Wiadomości bezpośrednie",
  back: "Wróć",
  add: "Dodaj",
  noMessages: "Brak wiadomości",
  selectThread: "Wybierz rozmowę z listy lub znajdź użytkownika po ID.",
  threadAttachments: "Załączniki rozmowy",
  noAttachments: "Brak załączników w tej rozmowie.",
  writePlaceholder: "Napisz wiadomość…",
  send: "Wyślij",
  addAttachment: "Dodaj załącznik",
  removeAttachment: "Usuń załącznik",
  removeThread: "Usuń rozmowę",
  invalidFileType: "Niedozwolony typ pliku.",
  attachmentLimit: "Przekroczono łączny limit 100 MB załączników w tej rozmowie.",
  sendFail: "Nie udało się wysłać wiadomości.",
  invalidUserId: "Podaj prawidłowe ID użytkownika.",
  cannotMessageSelf: "Nie możesz napisać do siebie.",
  findUserFail: "Nie udało się znaleźć użytkownika.",
  deleteThreadConfirm: "Usunąć tę rozmowę z listy?",
  deleteThreadFail: "Nie udało się usunąć wątku.",
  deleteError: "Błąd usuwania.",
};

const en: ContactInboxDictionary = {
  ...pl,
  loading: "Loading messages…",
  title: "Direct messages",
  back: "Back",
  add: "Add",
  noMessages: "No messages",
  selectThread: "Select a conversation or find a user by ID.",
  threadAttachments: "Conversation attachments",
  noAttachments: "No attachments in this conversation.",
  writePlaceholder: "Write a message…",
  send: "Send",
  addAttachment: "Add attachment",
  removeAttachment: "Remove attachment",
  removeThread: "Remove conversation",
  invalidFileType: "File type not allowed.",
  attachmentLimit: "100 MB attachment limit exceeded for this conversation.",
  sendFail: "Could not send message.",
  invalidUserId: "Enter a valid user ID.",
  cannotMessageSelf: "You cannot message yourself.",
  findUserFail: "Could not find user.",
  deleteThreadConfirm: "Remove this conversation from the list?",
  deleteThreadFail: "Could not delete thread.",
  deleteError: "Delete failed.",
};

const uk: ContactInboxDictionary = {
  ...en,
  loading: "Завантаження повідомлень…",
  title: "Прямі повідомлення",
  back: "Назад",
  add: "Додати",
  noMessages: "Немає повідомлень",
  selectThread: "Оберіть розмову або знайдіть користувача за ID.",
  threadAttachments: "Вкладення розмови",
  noAttachments: "Немає вкладень у цій розмові.",
  writePlaceholder: "Напишіть повідомлення…",
  send: "Надіслати",
  addAttachment: "Додати вкладення",
  removeAttachment: "Видалити вкладення",
  removeThread: "Видалити розмову",
  invalidFileType: "Недозволений тип файлу.",
  attachmentLimit: "Перевищено ліміт 100 МБ вкладень у цій розмові.",
  sendFail: "Не вдалося надіслати повідомлення.",
  invalidUserId: "Введіть коректний ID користувача.",
  cannotMessageSelf: "Не можна писати собі.",
  findUserFail: "Не вдалося знайти користувача.",
  deleteThreadConfirm: "Видалити цю розмову зі списку?",
  deleteThreadFail: "Не вдалося видалити нитку.",
  deleteError: "Помилка видалення.",
};

export function getContactInboxDictionary(locale: Locale): ContactInboxDictionary {
  if (locale === "en") return en;
  if (locale === "uk") return uk;
  return pl;
}
