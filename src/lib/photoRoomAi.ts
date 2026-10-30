import sharp from 'sharp';
import { callOpenAiVisionJson, getOpenAiApiKey, resolveOpenAiModel } from '@/lib/openAiClient';

/** Typowe pomieszczenia — te same, co w wyborze ręcznym w aplikacji i na stronie. */
export const PHOTO_ROOM_DEFAULTS = [
  'Salon',
  'Kuchnia',
  'Sypialnia',
  'Pokój',
  'Pokój dziecięcy',
  'Gabinet',
  'Łazienka',
  'WC',
  'Przedpokój',
  'Garderoba',
  'Balkon',
  'Taras',
  'Ogród',
  'Garaż',
  'Budynek',
  'Widok',
];

export type PhotoRoomSuggestion = { id: string; room: string | null; confidence: number };

const BATCH = 8;

async function thumbDataUrl(buffer: Buffer): Promise<string | null> {
  try {
    const jpg = await sharp(buffer).rotate().resize(384, 384, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 68 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString('base64')}`;
  } catch {
    return null;
  }
}

function roomOptions(scanned: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...scanned, ...PHOTO_ROOM_DEFAULTS]) {
    const label = String(name || '').trim().slice(0, 60);
    const key = label.toLocaleLowerCase('pl');
    if (!label || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out.slice(0, 40);
}

/**
 * „To wygląda na kuchnię” — AI przypisuje zdjęcia do pomieszczeń z listy (najpierw te ze skanu oferty).
 * Miniatury 384 px w niskiej szczegółowości, po 8 zdjęć w jednym zapytaniu: koszt to ułamek grosza za zdjęcie.
 */
export async function suggestPhotoRooms(
  images: Array<{ id: string; buffer: Buffer }>,
  scannedRooms: string[] = [],
): Promise<PhotoRoomSuggestion[]> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !images.length) return [];
  const options = roomOptions(scannedRooms);
  const enumValues = [...options, 'Nie wiem'];
  const out: PhotoRoomSuggestion[] = [];
  for (let i = 0; i < images.length; i += BATCH) {
    const batch = images.slice(i, i + BATCH);
    const thumbs = await Promise.all(batch.map((img) => thumbDataUrl(img.buffer)));
    const valid = batch.map((img, k) => ({ id: img.id, url: thumbs[k] })).filter((x): x is { id: string; url: string } => Boolean(x.url));
    if (!valid.length) continue;
    try {
      const { text } = await callOpenAiVisionJson({
        apiKey,
        model: resolveOpenAiModel(),
        feature: 'photo-room',
        system:
          'Jesteś asystentem agenta nieruchomości. Rozpoznajesz, jakie pomieszczenie przedstawia każde zdjęcie oferty. ' +
          'Wybierasz wyłącznie nazwę z podanej listy. Gdy na liście są konkretne pokoje ze skanu (np. „Sypialnia”, „Pokój”), ' +
          'dopasuj do nich zdjęcie. Salon z aneksem kuchennym to „Salon”, chyba że kadr pokazuje głównie kuchnię. ' +
          'Zdjęcia z zewnątrz: budynek, klatka, otoczenie → „Budynek”, widok z okna → „Widok”. Jeśli nie da się ocenić, wybierz „Nie wiem”.',
        prompt:
          `Lista pomieszczeń: ${options.join(', ')}.\n` +
          `Zdjęć: ${valid.length}. Dla każdego zdjęcia (w kolejności, numer od 0) podaj pomieszczenie i pewność 0–1.`,
        images: valid.map((v) => v.url),
        maxOutputTokens: 400,
        jsonSchema: {
          name: 'photo_rooms',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['items'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['index', 'room', 'confidence'],
                  properties: {
                    index: { type: 'integer' },
                    room: { type: 'string', enum: enumValues },
                    confidence: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      });
      const parsed = JSON.parse(text) as { items?: Array<{ index: number; room: string; confidence: number }> };
      for (const item of parsed.items || []) {
        const target = valid[item.index];
        if (!target) continue;
        const room = item.room && item.room !== 'Nie wiem' && options.includes(item.room) ? item.room : null;
        out.push({ id: target.id, room, confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)) });
      }
    } catch (err) {
      console.warn('[photo-room-ai]', err instanceof Error ? err.message : err);
    }
  }
  return out;
}
