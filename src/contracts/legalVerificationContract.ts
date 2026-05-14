/**
 * ====================================================================
 *  EstateOS™ — Kontrakt weryfikacji prawnej oferty (KW + nr lokalu)
 * ====================================================================
 *
 *  CZEMU TEN PLIK W OGÓLE ISTNIEJE
 *  --------------------------------
 *  „Weryfikacja prawna" to przepływ, w którym właściciel zgłasza numer
 *  księgi wieczystej (KW) i numer mieszkania administratorowi EstateOS™,
 *  a admin po manualnym sprawdzeniu w EKW (Elektroniczne Księgi Wieczyste)
 *  ACK-uje albo odrzuca z powodem. Po akceptacji na karcie oferty zapala
 *  się zielony znaczek „Zweryfikowano prawnie" — czyli `isLegalSafeVerified`
 *  staje się `true`.
 *
 *  DECYZJA ARCHITEKTONICZNA
 *  -------------------------
 *  Nie tworzymy osobnej tabeli `verification_request`. Dane są atrybutami
 *  oferty (1:1) — `landRegistryNumber`, `apartmentNumber` JUŻ siedzą na
 *  ofercie. Dodajemy do oferty cztery audytowe kolumny:
 *    • `legalCheckStatus`        — stan maszyny ('NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED')
 *    • `legalCheckSubmittedAt`   — kiedy właściciel zgłosił
 *    • `legalCheckReviewedAt`    — kiedy admin podjął decyzję
 *    • `legalCheckReviewedBy`    — userId admina
 *    • `legalCheckRejectionReason` — powód odrzucenia (string, opcjonalne)
 *
 *  „Kolejka weryfikacji" w panelu admina to po prostu zapytanie filtrowane:
 *    GET /api/mobile/v1/admin/legal-verification?status=PENDING
 *
 *  STATE MACHINE
 *  --------------
 *      NONE ──(owner submits KW)──▶ PENDING
 *      PENDING ──(admin approves)──▶ VERIFIED   (sets isLegalSafeVerified=true)
 *      PENDING ──(admin rejects)───▶ REJECTED   (owner may resubmit)
 *      REJECTED ──(owner resubmits)─▶ PENDING
 *      VERIFIED ──(KW number changed)─▶ PENDING (admin must re-verify)
 *
 *  Ten plik jest pojedynczym źródłem prawdy dla front-endu I back-endu.
 *  Backend MUSI używać tych samych nazw pól (snake_case → camelCase mapping
 *  po stronie API: patrz `deploy/HANDOFF_LEGAL_VERIFICATION.md`).
 */

type AnyObj = Record<string, any>;

// --------------------------------------------------------------------
// Stany maszyny — KOLEJNOŚĆ NIEPRZYPADKOWA (od „nic" do „rozstrzygnięte")
// --------------------------------------------------------------------
export const LEGAL_VERIFICATION_STATUSES = [
  'NONE',
  'PENDING',
  'VERIFIED',
  'REJECTED',
] as const;
export type LegalVerificationStatus = (typeof LEGAL_VERIFICATION_STATUSES)[number];

// --------------------------------------------------------------------
// Powody odrzucenia — kontrolowana lista, żeby UI miał sensowne fallbacki
// na wypadek nieznanego stringa. „OTHER" zawsze towarzyszy `reasonText`.
// --------------------------------------------------------------------
export const LEGAL_VERIFICATION_REJECTION_REASONS = [
  'KW_NOT_FOUND',                // nie znaleziono księgi
  'KW_NUMBER_MISMATCH',          // KW istnieje, ale dotyczy innej nieruchomości
  'APARTMENT_NUMBER_MISMATCH',   // nr mieszkania nie zgadza się z KW
  'OWNER_NAME_MISMATCH',         // KW ma innego właściciela niż konto
  'DEBT_OR_ENCUMBRANCE',         // hipoteka / zadłużenie wymagające uzgodnienia
  'EXPIRED_OR_INVALID_FORMAT',   // niepoprawny format / nieczytelne
  'OTHER',                       // wolny tekst w `reasonText`
] as const;
export type LegalVerificationRejectionReason =
  (typeof LEGAL_VERIFICATION_REJECTION_REASONS)[number];

// --------------------------------------------------------------------
// PAYLOAD: właściciel zgłasza KW (Owner → Backend)
//   POST /api/mobile/v1/offers/:offerId/legal-verification/submit
// --------------------------------------------------------------------
export type SubmitLegalVerificationPayload = {
  landRegistryNumber: string;   // format WA4M/00012345/6
  apartmentNumber: string;      // np. „14A" lub „—" dla domu jednorodzinnego
  // Krótka notatka właściciela do admina (np. „mieszkanie po teściach,
  // księga założona w 2009 r."). Nieobowiązkowe.
  ownerNote?: string | null;
};

// --------------------------------------------------------------------
// RESPONSE: aktualny stan weryfikacji dla danej oferty (Backend → Frontend)
//   GET /api/mobile/v1/offers/:offerId/legal-verification
// --------------------------------------------------------------------
export type OfferLegalVerificationView = {
  offerId: number;
  status: LegalVerificationStatus;
  landRegistryNumber: string | null;
  apartmentNumber: string | null;
  submittedAt: string | null;           // ISO8601
  reviewedAt: string | null;            // ISO8601
  reviewedByName: string | null;        // imię / handle admina (do wyświetlenia)
  rejection: null | {
    reasonCode: LegalVerificationRejectionReason;
    reasonText: string | null;
  };
  // Kanonicznie wyliczana flaga: status === 'VERIFIED' && legalCheckReviewedAt != null.
  // Front-end NIE liczy jej sam — bierzemy z serwera, żeby uniknąć rozjazdu.
  isLegalSafeVerified: boolean;
};

// --------------------------------------------------------------------
// PAYLOAD: admin akceptuje / odrzuca
//   POST /api/mobile/v1/admin/legal-verification/:offerId/approve
//   POST /api/mobile/v1/admin/legal-verification/:offerId/reject
// --------------------------------------------------------------------
export type AdminApproveLegalVerificationPayload = {
  // Nic — kontekst (offerId + adminId z tokenu) wystarcza.
  // Opcjonalnie: notatka wewnętrzna, niewidoczna dla właściciela.
  internalNote?: string | null;
};

export type AdminRejectLegalVerificationPayload = {
  reasonCode: LegalVerificationRejectionReason;
  reasonText?: string | null;   // wymagane przy `OTHER`, w innych przypadkach
                                // opcjonalne, doprecyzowanie dla właściciela
};

// --------------------------------------------------------------------
// ELEMENT KOLEJKI ADMINA — minimalny opis do listy
//   GET /api/mobile/v1/admin/legal-verification?status=PENDING&limit=50
// --------------------------------------------------------------------
export type AdminLegalVerificationQueueItem = {
  offerId: number;
  offerTitle: string;
  ownerId: number;
  ownerName: string;
  city: string | null;
  district: string | null;
  street: string | null;
  apartmentNumber: string | null;
  landRegistryNumber: string;
  submittedAt: string;                  // ISO8601
  status: Extract<LegalVerificationStatus, 'PENDING' | 'REJECTED'>;
  ownerNote: string | null;
  // Bezpośredni link do EKW (otwierany po naciśnięciu „Sprawdź w EKW"):
  //   https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/
  //   wyszukiwanieKW?komunikaty=true&kontakt=true&okienkoSerwisowe=false
  // Pole `ekwQuickLink` jest wyliczane na backendzie tylko jako wygodny
  // pre-fill (URL z `numerKsiegi` w query), żeby admin nie musiał kopiować
  // numeru ręcznie.
  ekwQuickLink: string | null;
};

export type AdminLegalVerificationQueueResponse = {
  items: AdminLegalVerificationQueueItem[];
  total: number;
  nextCursor: string | null;
};

// --------------------------------------------------------------------
// Walidatory — używane po obu stronach (front i back) żeby reguły
// były dokładnie te same.
// --------------------------------------------------------------------
export function isLegalVerificationStatus(value: unknown): value is LegalVerificationStatus {
  const v = String(value || '').trim().toUpperCase();
  return (LEGAL_VERIFICATION_STATUSES as readonly string[]).includes(v);
}

export function isLegalVerificationRejectionReason(
  value: unknown,
): value is LegalVerificationRejectionReason {
  const v = String(value || '').trim().toUpperCase();
  return (LEGAL_VERIFICATION_REJECTION_REASONS as readonly string[]).includes(v);
}

export function normalizeLegalVerificationStatus(raw: unknown): LegalVerificationStatus {
  const v = String(raw || '').trim().toUpperCase();
  if ((LEGAL_VERIFICATION_STATUSES as readonly string[]).includes(v)) {
    return v as LegalVerificationStatus;
  }
  // Stare oferty bez statusu → traktujemy jako „NONE" (brak zgłoszenia).
  return 'NONE';
}

/**
 * Bezpieczna deserializacja widoku weryfikacji — zwraca obiekt nawet
 * jeśli serwer odpowie nietypowo / brak pól / nulle. Front-end nie powinien
 * NIGDY rzucać wyjątkami na podstawie odpowiedzi tego endpointu.
 */
export function parseOfferLegalVerificationView(raw: AnyObj, fallbackOfferId: number): OfferLegalVerificationView {
  const status = normalizeLegalVerificationStatus(raw?.status);
  const rejectionRaw = raw?.rejection;
  const rejection =
    rejectionRaw && typeof rejectionRaw === 'object'
      ? {
          reasonCode: isLegalVerificationRejectionReason(rejectionRaw.reasonCode)
            ? (rejectionRaw.reasonCode as LegalVerificationRejectionReason)
            : ('OTHER' as LegalVerificationRejectionReason),
          reasonText:
            typeof rejectionRaw.reasonText === 'string' && rejectionRaw.reasonText.trim().length > 0
              ? rejectionRaw.reasonText.trim()
              : null,
        }
      : null;
  return {
    offerId: Number(raw?.offerId) || fallbackOfferId,
    status,
    landRegistryNumber:
      typeof raw?.landRegistryNumber === 'string' && raw.landRegistryNumber.trim()
        ? raw.landRegistryNumber.trim()
        : null,
    apartmentNumber:
      typeof raw?.apartmentNumber === 'string' && raw.apartmentNumber.trim()
        ? raw.apartmentNumber.trim()
        : null,
    submittedAt: typeof raw?.submittedAt === 'string' ? raw.submittedAt : null,
    reviewedAt: typeof raw?.reviewedAt === 'string' ? raw.reviewedAt : null,
    reviewedByName: typeof raw?.reviewedByName === 'string' ? raw.reviewedByName : null,
    rejection,
    isLegalSafeVerified: status === 'VERIFIED' && Boolean(raw?.reviewedAt),
  };
}

/**
 * Czytelna etykieta po polsku dla danego powodu odrzucenia.
 * Używana zarówno w UI właściciela („Odrzucono: …"), jak i w panelu admina
 * (jako labelka w picker-ze).
 */
export function getRejectionReasonLabel(code: LegalVerificationRejectionReason): string {
  switch (code) {
    case 'KW_NOT_FOUND':
      return 'Nie znaleziono księgi w EKW';
    case 'KW_NUMBER_MISMATCH':
      return 'Numer KW dotyczy innej nieruchomości';
    case 'APARTMENT_NUMBER_MISMATCH':
      return 'Numer lokalu nie zgadza się z księgą';
    case 'OWNER_NAME_MISMATCH':
      return 'Właściciel w KW to inna osoba';
    case 'DEBT_OR_ENCUMBRANCE':
      return 'Hipoteka / zadłużenie do uzgodnienia';
    case 'EXPIRED_OR_INVALID_FORMAT':
      return 'Niepoprawny / nieczytelny format';
    case 'OTHER':
      return 'Inny powód (zobacz notatkę)';
    default:
      return 'Inny powód';
  }
}

/**
 * Krótka etykieta dla badge'a statusu — używana w UI właściciela
 * (mała pigułka z kolorem) i w nagłówku karty admina.
 */
export function getLegalVerificationStatusLabel(status: LegalVerificationStatus): string {
  switch (status) {
    case 'VERIFIED':
      return 'Zweryfikowano prawnie';
    case 'PENDING':
      return 'Weryfikacja w toku';
    case 'REJECTED':
      return 'Wymaga poprawy';
    case 'NONE':
    default:
      return 'Niezweryfikowano';
  }
}

// --------------------------------------------------------------------
// Endpointy — pojedyncze źródło prawdy. Front-endowe `services/*`
// importują te ścieżki. Jeśli backend zmieni route, ZMIENIAMY TYLKO TU.
// --------------------------------------------------------------------
export const LEGAL_VERIFICATION_ENDPOINTS = {
  // OWNER:
  ownerStatus: (offerId: number | string) =>
    `/api/mobile/v1/offers/${offerId}/legal-verification`,
  ownerSubmit: (offerId: number | string) =>
    `/api/mobile/v1/offers/${offerId}/legal-verification/submit`,
  // ADMIN:
  adminQueue: (status: LegalVerificationStatus = 'PENDING') =>
    `/api/mobile/v1/admin/legal-verification?status=${status}`,
  adminApprove: (offerId: number | string) =>
    `/api/mobile/v1/admin/legal-verification/${offerId}/approve`,
  adminReject: (offerId: number | string) =>
    `/api/mobile/v1/admin/legal-verification/${offerId}/reject`,
} as const;
