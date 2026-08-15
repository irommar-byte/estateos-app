/**
 * Lightweight check whether a portal listing URL is still publicly available.
 * Does not run the full import pipeline.
 */
export async function verifyPortalListingActive(portalUrl: string): Promise<{
  active: boolean;
  reason: string | null;
  httpStatus: number | null;
}> {
  const url = String(portalUrl || '').trim();
  if (!url) {
    return { active: false, reason: 'Brak linku portalu.', httpStatus: null };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timer);
    }

    const status = res.status;
    if (status === 404 || status === 410) {
      return { active: false, reason: 'Ogłoszenie niedostępne na portalu (404).', httpStatus: status };
    }
    if (status >= 400) {
      return {
        active: false,
        reason: `Portal zwrócił błąd HTTP ${status}.`,
        httpStatus: status,
      };
    }

    const html = (await res.text()).slice(0, 180_000).toLowerCase();
    const inactiveMarkers = [
      'ogłoszenie nieaktualne',
      'ogłoszenie wygasło',
      'ogłoszenie zostało usunięte',
      'to ogłoszenie jest już nieaktualne',
      'listing is no longer available',
      'page not found',
      'nie znaleziono ogłoszenia',
      'oferta została zakończona',
      'ogłoszenie archiwalne',
      'this ad is no longer available',
      '"adstatus":"outdated"',
      '"adstatus":"removed"',
      'data-cy="listing-unavailable"',
    ];
    for (const marker of inactiveMarkers) {
      if (html.includes(marker)) {
        return { active: false, reason: 'Ogłoszenie nieaktualne / usunięte na portalu.', httpStatus: status };
      }
    }

    return { active: true, reason: null, httpStatus: status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Błąd weryfikacji';
    if (/abort/i.test(message)) {
      return { active: false, reason: 'Timeout weryfikacji portalu.', httpStatus: null };
    }
    return { active: false, reason: `Nie udało się sprawdzić portalu: ${message}`, httpStatus: null };
  }
}

export async function verifyPortalListingsActive(
  portalUrls: string[],
  concurrency = 3,
): Promise<Map<string, Awaited<ReturnType<typeof verifyPortalListingActive>>>> {
  const unique = [...new Set(portalUrls.map((u) => String(u || '').trim()).filter(Boolean))];
  const out = new Map<string, Awaited<ReturnType<typeof verifyPortalListingActive>>>();
  let cursor = 0;

  async function worker() {
    while (cursor < unique.length) {
      const index = cursor;
      cursor += 1;
      const url = unique[index];
      out.set(url, await verifyPortalListingActive(url));
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, unique.length)) }, () => worker());
  await Promise.all(workers);
  return out;
}
