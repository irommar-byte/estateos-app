export type DeskMessageTemplate = {
  id: string;
  label: string;
  subject?: string;
  body: string;
};

export const DESK_TEMPLATES: DeskMessageTemplate[] = [
  {
    id: 'first_contact',
    label: 'Pierwsza wiadomość',
    subject: 'Współpraca przy sprzedaży nieruchomości',
    body: 'Dzień dobry,\n\nzainteresowałem się Państwa nieruchomością i chciałbym zaproponować profesjonalne prowadzenie sprzedaży. Czy moglibyśmy umówić krótką rozmowę?\n\nPozdrawiam',
  },
  {
    id: 'follow_up',
    label: 'Follow-up',
    body: 'Dzień dobry,\n\nwracam do naszej rozmowy. Czy udało się przemyśleć współpracę? Chętnie odpowiem na pytania.\n\nPozdrawiam',
  },
  {
    id: 'send_3_offers',
    label: 'Wysyłam 3 oferty',
    subject: '3 oferty dopasowane do Państwa kryteriów',
    body: 'Dzień dobry,\n\nprzygotowałem 3 oferty, które najlepiej pasują do Państwa kryteriów. Proszę o krótką ocenę każdej — to pomoże zawęzić poszukiwania.\n\nPozdrawiam',
  },
  {
    id: 'confirm_presentation',
    label: 'Potwierdzenie prezentacji',
    subject: 'Potwierdzenie prezentacji',
    body: 'Dzień dobry,\n\npotwierdzam prezentację w umówionym terminie. Do zobaczenia na miejscu.\n\nPozdrawiam',
  },
  {
    id: 'presentation_summary',
    label: 'Podsumowanie prezentacji',
    body: 'Dzień dobry,\n\ndziękuję za dzisiejszą prezentację. Poniżej krótkie podsumowanie i proponowany następny krok.\n\nPozdrawiam',
  },
  {
    id: 'ask_documents',
    label: 'Prośba o dokumenty',
    subject: 'Dokumenty do przygotowania oferty',
    body: 'Dzień dobry,\n\nproszę o uzupełnienie dokumentów (KW, opłaty, świadectwo energetyczne). Lista checklisty jest też na portalu klienta.\n\nPozdrawiam',
  },
  {
    id: 'price_change',
    label: 'Informacja o zmianie ceny',
    subject: 'Aktualizacja ceny nieruchomości',
    body: 'Dzień dobry,\n\ninformuję o aktualizacji ceny oferty. Jeśli nadal Państwa interesuje — chętnie umówię prezentację.\n\nPozdrawiam',
  },
  {
    id: 'oh_followup',
    label: 'Follow-up po Open House',
    body: 'Dzień dobry,\n\ndziękuję za udział w dniu otwartym. Czy nieruchomość spełnia oczekiwania? Mogę umówić indywidualną prezentację.\n\nPozdrawiam',
  },
  {
    id: 'auction_followup',
    label: 'Follow-up po aukcji',
    body: 'Dzień dobry,\n\ndziękuję za udział w licytacji. Jeśli chcą Państwo kontynuować rozmowy — jestem do dyspozycji.\n\nPozdrawiam',
  },
  {
    id: 'ask_review',
    label: 'Prośba o opinię',
    subject: 'Krótka opinia o współpracy',
    body: 'Dzień dobry,\n\ndziękuję za współpracę. Będzie mi miło, jeśli zostawią Państwo krótką opinię — to pomaga innym klientom.\n\nPozdrawiam',
  },
  {
    id: 'ask_referral',
    label: 'Prośba o polecenie',
    body: 'Dzień dobry,\n\njeśli ktoś z Państwa znajomych sprzedaje lub szuka nieruchomości, chętnie pomogę. Dziękuję za zaufanie.\n\nPozdrawiam',
  },
];
