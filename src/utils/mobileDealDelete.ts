import { API_URL } from '../config/network';

function humanStatus(status: number): string {
  if (status === 401) return 'Sesja wygasła — zaloguj się ponownie i spróbuj jeszcze raz.';
  if (status === 403) return 'Nie masz uprawnień do usunięcia tej transakcji.';
  if (status === 404) {
    return 'Nie znaleziono zasobu (404). Jeśli transakcja jest na liście, problemem może być wdrożenie API albo zły adres serwera w aplikacji.';
  }
  if (status === 405) return 'Ten serwer nie obsługuje usuwania transakcji z aplikacji.';
  if (status >= 500) return 'Chwilowy błąd serwera. Spróbuj ponownie za chwilę.';
  return `Nie udało się usunąć (kod ${status}).`;
}

const HTML_HINT_404 =
  'Serwer zwrócił stronę HTML (404) zamiast JSON — najczęściej brakuje trasy DELETE na wdrożonym API lub zapytanie nie trafia do aplikacji Next (nginx/proxy).';

/** Z odpowiedzi HTTP robi krótki tekst do Alert — nigdy surowego HTML. */
export function humanizeDealDeleteFailure(status: number, rawBody: string): string {
  const s = String(rawBody ?? '').trim();
  const isHtml =
    s.startsWith('<') ||
    /<!DOCTYPE/i.test(s) ||
    /<html[\s>]/i.test(s) ||
    /<body[\s>]/i.test(s);

  if (isHtml) {
    return status === 404 ? HTML_HINT_404 : humanStatus(status);
  }

  try {
    const j = JSON.parse(s) as { error?: string; message?: string; detail?: string };
    const m = j.error ?? j.message ?? j.detail;
    if (typeof m === 'string' && m.length > 0 && !/<[^>]{1,8}>/.test(m)) {
      return m.length > 220 ? `${m.slice(0, 217)}…` : m;
    }
  } catch {
    if (s.length > 0 && s.length < 400 && !s.includes('<')) return s;
  }

  if (status === 404 && !s) {
    return 'Serwer zwrócił 404 bez treści — endpoint DELETE /api/mobile/v1/deals/:id najpewniej nie jest jeszcze na produkcji pod tym samym hostem co reszta API (sprawdź deploy i zmienną API_URL).';
  }

  return humanStatus(status);
}

export async function requestMobileDealDeletion(
  dealId: number,
  token: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const url = `${API_URL}/api/mobile/v1/deals/${dealId}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (res.ok) return { ok: true };

  const body = await res.text().catch(() => '');

  if (__DEV__) {
    console.warn('[mobileDealDelete]', {
      url,
      status: res.status,
      bodyLen: body.length,
      preview: body.slice(0, 160),
    });
  }

  return { ok: false, message: humanizeDealDeleteFailure(res.status, body) };
}
