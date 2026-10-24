import { prisma } from '@/lib/prisma';

/**
 * Dokumenty klienta — lista „co jeszcze brakuje”.
 * Domyślna lista tworzy się przy pierwszym otwarciu; agent może dopisać własne pozycje.
 * Statusy: missing → uploaded (klient wrzucił) → accepted / rejected (agent sprawdził).
 */

export type DocumentStatus = 'missing' | 'uploaded' | 'accepted' | 'rejected';

type DefaultItem = { key: string; label: string; hint?: string; required?: boolean };

const SELLER_DEFAULTS: DefaultItem[] = [
  { key: 'kw', label: 'Numer księgi wieczystej', hint: 'Wystarczy zdjęcie albo wpisany numer — odpis pobiorę sam.' },
  { key: 'ownership', label: 'Podstawa nabycia', hint: 'Akt notarialny kupna, darowizny albo postanowienie o spadku.' },
  { key: 'no_debts', label: 'Zaświadczenie o braku zaległości', hint: 'Ze spółdzielni albo od zarządcy wspólnoty.' },
  { key: 'no_residents', label: 'Zaświadczenie o braku zameldowanych osób', hint: 'Z urzędu gminy — do aktu notarialnego.' },
  { key: 'mortgage_balance', label: 'Zaświadczenie z banku o saldzie kredytu', hint: 'Tylko jeśli na mieszkaniu jest hipoteka.', required: false },
  { key: 'energy', label: 'Świadectwo charakterystyki energetycznej', hint: 'Jeśli go nie ma — pomogę je zamówić.' },
  { key: 'plan', label: 'Rzut lub dokumentacja lokalu', hint: 'Jeśli masz — przyda się do ogłoszenia.', required: false },
];

const BUYER_DEFAULTS: DefaultItem[] = [
  { key: 'id', label: 'Dane do umowy', hint: 'Imię, nazwisko, PESEL i adres — wystarczy zdjęcie dowodu (bez rewersu z CAN).' },
  { key: 'financing', label: 'Potwierdzenie finansowania', hint: 'Wyciąg ze środkami albo decyzja / promesa kredytowa.' },
  { key: 'mortgage_decision', label: 'Decyzja kredytowa', hint: 'Jeśli kupujesz z kredytem.', required: false },
  { key: 'income', label: 'Zaświadczenie o dochodach', hint: 'Do wniosku kredytowego — jeśli bank o nie prosi.', required: false },
  { key: 'poa', label: 'Pełnomocnictwo', hint: 'Tylko jeśli ktoś będzie podpisywał w Twoim imieniu.', required: false },
];

export type ClientDocumentView = {
  key: string;
  label: string;
  hint: string | null;
  required: boolean;
  status: DocumentStatus;
  fileName: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  note: string | null;
  uploadedAt: string | null;
  reviewedAt: string | null;
};

function toView(row: {
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
}): ClientDocumentView {
  const status = (['missing', 'uploaded', 'accepted', 'rejected'].includes(row.status) ? row.status : 'missing') as DocumentStatus;
  return {
    key: row.itemKey,
    label: row.label,
    hint: row.hint,
    required: row.required,
    status,
    fileName: row.fileName,
    fileUrl: row.fileUrl,
    mimeType: row.mimeType,
    note: row.note,
    uploadedAt: row.uploadedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

export async function loadClientDocuments(clientId: number, clientType: string): Promise<ClientDocumentView[]> {
  let rows = await prisma.clientDocumentItem.findMany({ where: { clientId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  if (!rows.length) {
    const defaults = clientType === 'SELLER' ? SELLER_DEFAULTS : BUYER_DEFAULTS;
    await prisma.clientDocumentItem
      .createMany({
        data: defaults.map((item, index) => ({
          clientId,
          itemKey: item.key,
          label: item.label,
          hint: item.hint ?? null,
          required: item.required !== false,
          sortOrder: index * 10,
        })),
        skipDuplicates: true,
      })
      .catch(() => null);
    rows = await prisma.clientDocumentItem.findMany({ where: { clientId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  }
  return rows.map(toView);
}

export function documentsSummary(items: ClientDocumentView[]) {
  const required = items.filter((i) => i.required);
  const done = required.filter((i) => i.status === 'accepted' || i.status === 'uploaded').length;
  const missing = required.filter((i) => i.status === 'missing' || i.status === 'rejected').length;
  return { required: required.length, done, missing, toReview: items.filter((i) => i.status === 'uploaded').length };
}

export async function attachClientDocument(params: {
  clientId: number;
  itemKey: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
}) {
  const row = await prisma.clientDocumentItem.findUnique({
    where: { clientId_itemKey: { clientId: params.clientId, itemKey: params.itemKey } },
  });
  if (!row) throw new Error('Nie znaleziono pozycji na liście dokumentów.');
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

export async function reviewClientDocument(params: { clientId: number; itemKey: string; status: 'accepted' | 'rejected' | 'missing'; note?: string | null }) {
  const row = await prisma.clientDocumentItem.findUnique({
    where: { clientId_itemKey: { clientId: params.clientId, itemKey: params.itemKey } },
  });
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
  const last = await prisma.clientDocumentItem.findFirst({ where: { clientId: params.clientId }, orderBy: { sortOrder: 'desc' } });
  const created = await prisma.clientDocumentItem.create({
    data: {
      clientId: params.clientId,
      itemKey: `custom_${Date.now().toString(36)}`,
      label,
      hint: params.hint ? String(params.hint).slice(0, 300) : null,
      required: params.required !== false,
      sortOrder: (last?.sortOrder ?? 0) + 10,
    },
  });
  return toView(created);
}

export async function removeClientDocumentItem(clientId: number, itemKey: string) {
  await prisma.clientDocumentItem.deleteMany({ where: { clientId, itemKey } });
}
