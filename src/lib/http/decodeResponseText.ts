/**
 * Dekodowanie odpowiedzi HTTP z poszanowaniem kodowania źródła.
 *
 * `Response.text()` zawsze czyta UTF-8 — strony i systemy w ISO-8859-2 / Windows-1250
 * (starsze polskie serwisy) zamieniają wtedy „ł”, „ą”, „ż” w „�”, które trafiają do bazy.
 */

const CHARSET_ALIASES: Record<string, string> = {
  'iso8859-2': 'iso-8859-2',
  'iso_8859-2': 'iso-8859-2',
  latin2: 'iso-8859-2',
  'cp1250': 'windows-1250',
  'win-1250': 'windows-1250',
  'x-cp1250': 'windows-1250',
  utf8: 'utf-8',
};

function normalizeCharset(raw: string | null | undefined): string | null {
  const value = String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .toLowerCase();
  if (!value) return null;
  return CHARSET_ALIASES[value] || value;
}

export function charsetFromContentType(contentType: string | null | undefined): string | null {
  const match = String(contentType || '').match(/charset\s*=\s*([^;\s]+)/i);
  return normalizeCharset(match?.[1]);
}

function charsetFromMarkup(bytes: Uint8Array): string | null {
  // Wystarczy początek dokumentu — <meta charset> musi być w pierwszych 1024 bajtach.
  const head = Buffer.from(bytes.subarray(0, 4096)).toString('latin1');
  const meta =
    head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i) ||
    head.match(/<\?xml[^>]+encoding\s*=\s*["']([\w-]+)/i);
  return normalizeCharset(meta?.[1]);
}

function tryDecode(bytes: Uint8Array, charset: string, fatal = false): string | null {
  try {
    return new TextDecoder(charset, { fatal }).decode(bytes);
  } catch {
    return null;
  }
}

/** Dekoduje bajty: nagłówek → znacznik w dokumencie → ścisły UTF-8 → Windows-1250. */
export function decodeBytes(bytes: Uint8Array, contentType?: string | null): string {
  const declared = charsetFromContentType(contentType) || charsetFromMarkup(bytes);
  if (declared && declared !== 'utf-8') {
    const decoded = tryDecode(bytes, declared);
    if (decoded != null) return decoded;
  }
  const strictUtf8 = tryDecode(bytes, 'utf-8', true);
  if (strictUtf8 != null) return strictUtf8;
  // Niepoprawny UTF-8 bez deklaracji — w polskich serwisach to prawie zawsze Windows-1250.
  return tryDecode(bytes, 'windows-1250') ?? Buffer.from(bytes).toString('utf8');
}

export async function decodeResponseText(res: Response): Promise<string> {
  const buffer = new Uint8Array(await res.arrayBuffer());
  return decodeBytes(buffer, res.headers.get('content-type'));
}

/** Tekst z „�” oznacza, że źródło zostało źle odczytane — nie zapisujemy go do bazy. */
export function hasReplacementChars(text: string | null | undefined): boolean {
  return String(text || '').includes('�');
}

/** Usuwa znaki zastępcze z pól, których nie da się odtworzyć (np. adres z KEI). */
export function stripReplacementChars(text: string): string {
  return text.replace(/�+/g, '').replace(/\s{2,}/g, ' ').trim();
}
