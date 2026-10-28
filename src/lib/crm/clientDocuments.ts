import { prisma } from '@/lib/prisma';

/**
 * Dokumenty klienta — lista „co jeszcze brakuje”.
 * Nic nie pojawia się samo: agent wybiera, o co prosi (z podpowiedzi, swoich szablonów albo własne pole),
 * dopiero wtedy pozycja trafia do klienta. Agent może usunąć dowolną pozycję.
 * Statusy: missing → uploaded (klient wrzucił) → accepted / rejected (agent sprawdził).
 *          na = klient zaznaczył „nie dotyczy” (tylko pozycje „jeśli dotyczy”),
 *          removed = agent zdjął pozycję z listy (miękkie usunięcie, żeby domyślna lista nie wracała).
 */

export type DocumentStatus = 'missing' | 'uploaded' | 'accepted' | 'rejected' | 'na';
const VISIBLE_STATUSES: DocumentStatus[] = ['missing', 'uploaded', 'accepted', 'rejected', 'na'];
const REMOVED = 'removed';

type SuggestedItem = { key: string; label: string; hint?: string; required?: boolean };

const SELLER_SUGGESTIONS: SuggestedItem[] = [
  { key: 'kw', label: 'Numer księgi wieczystej', hint: 'Wystarczy zdjęcie albo wpisany numer — odpis pobiorę sam.' },
  { key: 'ownership', label: 'Podstawa nabycia', hint: 'Akt notarialny kupna, darowizny albo postanowienie o spadku.' },
  { key: 'no_debts', label: 'Zaświadczenie o braku zaległości', hint: 'Ze spółdzielni albo od zarządcy wspólnoty.' },
  { key: 'no_residents', label: 'Zaświadczenie o braku zameldowanych osób', hint: 'Z urzędu gminy — do aktu notarialnego.' },
  { key: 'mortgage_balance', label: 'Zaświadczenie z banku o saldzie kredytu', hint: 'Tylko jeśli na mieszkaniu jest hipoteka.', required: false },
  { key: 'energy', label: 'Świadectwo charakterystyki energetycznej', hint: 'Jeśli go nie ma — pomogę je zamówić.' },
  { key: 'plan', label: 'Rzut lub dokumentacja lokalu', hint: 'Jeśli masz — przyda się do ogłoszenia.', required: false },
];

const BUYER_SUGGESTIONS: SuggestedItem[] = [
  { key: 'id', label: 'Dane do umowy', hint: 'Imię, nazwisko, PESEL i adres — wystarczy zdjęcie dowodu (bez rewersu z CAN).' },
  { key: 'financing', label: 'Potwierdzenie finansowania', hint: 'Wyciąg ze środkami albo decyzja / promesa kredytowa.' },
  { key: 'mortgage_decision', label: 'Decyzja kredytowa', hint: 'Jeśli kupujesz z kredytem.', required: false },
  { key: 'income', label: 'Zaświadczenie o dochodach', hint: 'Do wniosku kredytowego — jeśli bank o nie prosi.', required: false },
  { key: 'poa', label: 'Pełnomocnictwo', hint: 'Tylko jeśli ktoś będzie podpisywał w Twoim imieniu.', required: false },
];

export type ClientDocumentView = {
  key: string;
  label: string;
  /** Komentarz agenta pod nazwą pola (co dokładnie, skąd wziąć). */
  hint: string | null;
  required: boolean;
  custom: boolean;
  status: DocumentStatus;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  note: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
};

type Row = {
  itemKey: string;
  label: string;
  hint: string | null;
  required: boolean;
  status: string;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  note: string | null;
  uploadedAt: Date | null;
  reviewedAt: Date | null;
  createdAt?: Date | null;
};

function toView(row: Row): ClientDocumentView {
  const status = (VISIBLE_STATUSES.includes(row.status as DocumentStatus) ? row.status : 'missing') as DocumentStatus;
  return {
    key: row.itemKey,
    label: row.label,
    hint: row.hint,
    required: row.required,
    custom: row.itemKey.startsWith('custom_'),
    status,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    note: row.note,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
  };
}

export async function loadClientDocuments(clientId: number): Promise<ClientDocumentView[]> {
  const rows = await prisma.clientDocumentItem.findMany({ where: { clientId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  return rows.filter((row) => row.status !== REMOVED).map(toView);
}

export type DocumentSuggestionView = { key: string; label: string; hint: string | null; required: boolean };

/** Typowe dokumenty dla sprzedającego / kupującego, których agent jeszcze nie poprosił. */
export function documentSuggestions(clientType: string, current: ClientDocumentView[]): DocumentSuggestionView[] {
  const taken = new Set(current.map((item) => item.key));
  return (clientType === 'SELLER' ? SELLER_SUGGESTIONS : BUYER_SUGGESTIONS)
    .filter((item) => !taken.has(item.key))
    .map((item) => ({ key: item.key, label: item.label, hint: item.hint ?? null, required: item.required !== false }));
}

/** Agent prosi o wybrane typowe dokumenty — także te, które wcześniej zdjął z listy. */
export async function addSuggestedDocuments(params: { clientId: number; clientType: string; keys: string[] }) {
  const wanted = new Set(params.keys.map(String));
  const items = (params.clientType === 'SELLER' ? SELLER_SUGGESTIONS : BUYER_SUGGESTIONS).filter((item) => wanted.has(item.key));
  if (!items.length) throw new Error('Wybierz co najmniej jeden dokument.');
  const last = await prisma.clientDocumentItem.findFirst({ where: { clientId: params.clientId }, orderBy: { sortOrder: 'desc' } });
  let sortOrder = last?.sortOrder ?? 0;
  for (const item of items) {
    sortOrder += 10;
    const data = { label: item.label, hint: item.hint ?? null, required: item.required !== false, updatedAt: new Date() };
    await prisma.clientDocumentItem.upsert({
      where: { clientId_itemKey: { clientId: params.clientId, itemKey: item.key } },
      create: { ...data, clientId: params.clientId, itemKey: item.key, sortOrder },
      update: {
        ...data,
        status: 'missing',
        fileUrl: null,
        fileName: null,
        mimeType: null,
        note: null,
        uploadedAt: null,
        reviewedAt: null,
        sortOrder,
      },
    });
  }
}

/**
 * Licznik „Brakuje X z Y”: Y to wszystkie pozycje na liście (także „jeśli dotyczy”),
 * X to te, które nadal czekają na plik albo są do poprawy. Dodanie pozycji przez agenta
 * od razu powiększa Y, usunięcie — zmniejsza.
 */
export function documentsSummary(items: ClientDocumentView[]) {
  const total = items.length;
  const done = items.filter((i) => i.status === 'accepted' || i.status === 'uploaded' || i.status === 'na').length;
  const missing = items.filter((i) => i.status === 'missing' || i.status === 'rejected').length;
  return {
    total,
    /** Zgodność wstecz: starsze klienty czytały `required` jako mianownik licznika. */
    required: total,
    done,
    missing,
    accepted: items.filter((i) => i.status === 'accepted').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    toReview: items.filter((i) => i.status === 'uploaded').length,
  };
}

async function findItem(clientId: number, itemKey: string) {
  const row = await prisma.clientDocumentItem.findUnique({ where: { clientId_itemKey: { clientId, itemKey } } });
  return row && row.status !== REMOVED ? row : null;
}

export async function attachClientDocument(params: {
  clientId: number;
  itemKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
}) {
  const row = await findItem(params.clientId, params.itemKey);
  if (!row) throw new Error('Tej pozycji nie ma już na liście dokumentów — agent mógł ją usunąć. Odśwież stronę.');
  if (row.status === 'accepted') throw new Error('Ten dokument jest już zaakceptowany przez agenta — nie trzeba go wysyłać ponownie.');
  const updated = await prisma.clientDocumentItem.update({
    where: { id: row.id },
    data: {
      status: 'uploaded',
      fileUrl: params.fileUrl.slice(0, 500),
      fileName: params.fileName.slice(0, 200),
      mimeType: params.mimeType.slice(0, 120),
      note: null,
      uploadedAt: new Date(),
      reviewedAt: null,
      updatedAt: new Date(),
    },
  });
  return toView(updated);
}

/** Klient zaznacza „nie dotyczy” (albo cofa) — tylko przy pozycjach „jeśli dotyczy”. */
export async function setClientDocumentNotApplicable(params: { clientId: number; itemKey: string; notApplicable: boolean }) {
  const row = await findItem(params.clientId, params.itemKey);
  if (!row) throw new Error('Tej pozycji nie ma już na liście dokumentów. Odśwież stronę.');
  if (row.required) throw new Error('Ten dokument jest wymagany — nie można go pominąć. Napisz do agenta, jeśli go nie masz.');
  if (row.status === 'uploaded' || row.status === 'accepted') throw new Error('Plik jest już wysłany.');
  const updated = await prisma.clientDocumentItem.update({
    where: { id: row.id },
    data: { status: params.notApplicable ? 'na' : 'missing', updatedAt: new Date() },
  });
  return toView(updated);
}

export async function reviewClientDocument(params: { clientId: number; itemKey: string; status: 'accepted' | 'rejected' | 'missing'; note?: string | null }) {
  const row = await findItem(params.clientId, params.itemKey);
  if (!row) throw new Error('Nie znaleziono dokumentu.');
  const updated = await prisma.clientDocumentItem.update({
    where: { id: row.id },
    data: {
      status: params.status,
      note: params.note ? String(params.note).slice(0, 500) : null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
      ...(params.status === 'missing' ? { fileUrl: null, fileName: null, mimeType: null, uploadedAt: null } : {}),
    },
  });
  return toView(updated);
}

export async function addClientDocumentItem(params: { clientId: number; label: string; hint?: string | null; required?: boolean }) {
  const label = String(params.label || '').trim().slice(0, 160);
  if (!label) throw new Error('Podaj nazwę dokumentu.');
  const hint = String(params.hint || '').trim().slice(0, 300) || null;
  const last = await prisma.clientDocumentItem.findFirst({ where: { clientId: params.clientId }, orderBy: { sortOrder: 'desc' } });
  const created = await prisma.clientDocumentItem.create({
    data: {
      clientId: params.clientId,
      itemKey: `custom_${Date.now().toString(36)}${Math.round(Math.random() * 1e3).toString(36)}`,
      label,
      hint,
      required: params.required !== false,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });
  return toView(created);
}

/** Agent zmienia nazwę, komentarz albo to, czy pozycja jest obowiązkowa. */
export async function updateClientDocumentItem(params: {
  clientId: number;
  itemKey: string;
  label?: string;
  hint?: string | null;
  required?: boolean;
}) {
  const row = await findItem(params.clientId, params.itemKey);
  if (!row) throw new Error('Nie znaleziono dokumentu.');
  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (params.label !== undefined) {
    const label = String(params.label).trim().slice(0, 160);
    if (!label) throw new Error('Nazwa dokumentu nie może być pusta.');
    data.label = label;
  }
  if (params.hint !== undefined) data.hint = String(params.hint || '').trim().slice(0, 300) || null;
  if (params.required !== undefined) {
    data.required = Boolean(params.required);
    if (params.required && row.status === 'na') data.status = 'missing';
  }
  const updated = await prisma.clientDocumentItem.update({ where: { id: row.id }, data });
  return toView(updated);
}

/** Usunięcie z listy — miękko, żeby historia pliku nie przepadła. */
export async function removeClientDocumentItem(clientId: number, itemKey: string) {
  const row = await findItem(clientId, itemKey);
  if (!row) return;
  await prisma.clientDocumentItem.update({ where: { id: row.id }, data: { status: REMOVED, updatedAt: new Date() } });
}

// ── Szablony agenta: pola zapisane „na zawsze” do ponownego użycia u kolejnych klientów ──

export type DocumentTemplateView = { id: number; label: string; hint: string | null; required: boolean };

export async function listDocumentTemplates(agencyUserId: number): Promise<DocumentTemplateView[]> {
  const rows = await prisma.agentDocumentTemplate
    .findMany({ where: { agencyUserId }, orderBy: [{ updatedAt: 'desc' }], take: 60 })
    .catch(() => []);
  return rows.map((row) => ({ id: row.id, label: row.label, hint: row.hint, required: row.required }));
}

export async function saveDocumentTemplate(params: { agencyUserId: number; label: string; hint?: string | null; required?: boolean }) {
  const label = String(params.label || '').trim().slice(0, 160);
  if (!label) throw new Error('Podaj nazwę dokumentu.');
  const hint = String(params.hint || '').trim().slice(0, 300) || null;
  const existing = await prisma.agentDocumentTemplate.findFirst({ where: { agencyUserId: params.agencyUserId, label } });
  const data = { label, hint, required: params.required !== false, updatedAt: new Date() };
  const row = existing
    ? await prisma.agentDocumentTemplate.update({ where: { id: existing.id }, data })
    : await prisma.agentDocumentTemplate.create({ data: { ...data, agencyUserId: params.agencyUserId } });
  return { id: row.id, label: row.label, hint: row.hint, required: row.required } satisfies DocumentTemplateView;
}

export async function deleteDocumentTemplate(agencyUserId: number, templateId: number) {
  await prisma.agentDocumentTemplate.deleteMany({ where: { id: templateId, agencyUserId } });
}
