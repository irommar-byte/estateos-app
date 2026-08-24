export type ClientNextStep = {
  id: string;
  label: string;
  hint: string;
  action:
    | 'verify_contact'
    | 'set_criteria'
    | 'refresh_matches'
    | 'send_offers'
    | 'collect_feedback'
    | 'propose_presentation'
    | 'accept_schedule'
    | 'open_portal'
    | 'finish_acquisition'
    | 'create_offer'
    | 'watch_listing';
};

export function resolveClientNextStep(input: {
  type: 'BUYER' | 'SELLER';
  email?: string | null;
  phone?: string | null;
  emailVerifiedAt?: string | Date | null;
  phoneVerifiedAt?: string | Date | null;
  linkedUserId?: number | null;
  hasCriteria: boolean;
  matchCount: number;
  sentCount: number;
  feedbackCount: number;
  meetingStatus?: 'confirmed' | 'pending' | null;
  presentationStatus?: 'confirmed' | 'pending' | null;
  acquisitionStatus?: string | null;
  linkedOfferId?: number | null;
}): ClientNextStep {
  if (!input.email && !input.phone) {
    return {
      id: 'verify_contact',
      label: 'Uzupełnij kontakt',
      hint: 'Bez e-maila albo telefonu klient nie dostanie panelu ani ofert.',
      action: 'verify_contact',
    };
  }

  if (input.meetingStatus === 'pending') {
    return {
      id: 'accept_schedule',
      label: 'Zatwierdź nowy termin',
      hint: 'Klient zaproponował zmianę — potwierdź albo zaproponuj inny.',
      action: 'accept_schedule',
    };
  }

  if (input.type === 'SELLER') {
    if (!input.meetingStatus) {
      return {
        id: 'propose_meeting',
        label: 'Umów spotkanie pozyskania',
        hint: 'To pierwszy konkretny krok ze sprzedającym.',
        action: 'accept_schedule',
      };
    }
    if (input.acquisitionStatus !== 'SIGNED') {
      return {
        id: 'finish_acquisition',
        label: 'Dokończ kartę pozyskania',
        hint: 'Warunki i podpis zamykają etap, zanim powstanie ogłoszenie.',
        action: 'finish_acquisition',
      };
    }
    if (!input.linkedOfferId) {
      return {
        id: 'create_offer',
        label: 'Zrób szkic oferty',
        hint: 'Umowa jest, ale klient jeszcze nie widzi ogłoszenia.',
        action: 'create_offer',
      };
    }
    return {
      id: 'watch_listing',
      label: 'Pokaż klientowi, że jesteśmy na rynku',
      hint: 'Otwórz panel i potwierdź publikację oraz kolejne ruchy.',
      action: 'open_portal',
    };
  }

  if (!input.hasCriteria) {
    return {
      id: 'set_criteria',
      label: 'Ustaw kryteria poszukiwań',
      hint: 'Bez ankiety radar i Intelligence nie mają czego dopasować.',
      action: 'set_criteria',
    };
  }
  if (input.matchCount === 0) {
    return {
      id: 'refresh_matches',
      label: 'Odśwież dopasowania',
      hint: 'Kryteria są, ale w puli nie ma jeszcze ofert powyżej progu.',
      action: 'refresh_matches',
    };
  }
  if (input.sentCount === 0) {
    return {
      id: 'send_offers',
      label: 'Wyślij pierwsze oferty',
      hint: 'Klient czeka na konkret, nie na listę w CRM.',
      action: 'send_offers',
    };
  }
  if (input.feedbackCount === 0) {
    return {
      id: 'collect_feedback',
      label: 'Zebrać reakcję klienta',
      hint: 'Oferty poszły — przypomnij o panelu albo zadzwoń.',
      action: 'open_portal',
    };
  }
  if (!input.presentationStatus) {
    return {
      id: 'propose_presentation',
      label: 'Umów prezentację',
      hint: 'Jest feedback. Wybierz ofertę z listy i zaproponuj termin obu stronom.',
      action: 'propose_presentation',
    };
  }
  return {
    id: 'send_next',
    label: 'Wyślij kolejną ofertę albo wróć do rozmowy',
    hint: 'Sprawa żyje — nie zostawiaj klienta bez następnego kroku.',
    action: 'send_offers',
  };
}
