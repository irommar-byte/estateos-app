/** Oficjalna przeglądarka EKW — formularz wymaga interakcji + ewentualnie CAPTCHA. */
export const EKW_SEARCH_URL =
  'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW';

export type EkwRegistryParts = {
  kodWydzialu: string;
  nrKw: string;
  cyfraK: string;
};

export function parseLandRegistryForEkw(value: string): EkwRegistryParts | null {
  const normalized = String(value || '').trim().toUpperCase();
  const match = normalized.match(/^([A-Z]{2}[0-9A-Z]{2})\/([0-9]{8})\/([0-9])$/);
  if (!match) return null;
  return {
    kodWydzialu: match[1],
    nrKw: match[2],
    cyfraK: match[3],
  };
}

export function buildEkwAutofillScript(parts: EkwRegistryParts): string {
  const kod = JSON.stringify(parts.kodWydzialu);
  const nr = JSON.stringify(parts.nrKw);
  const cyfra = JSON.stringify(parts.cyfraK);

  return `(function(){
    try {
      var kod=${kod}, nr=${nr}, cyfra=${cyfra};
      function setVal(el, v) {
        if (!el) return false;
        el.focus && el.focus();
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      function q(sel) { return document.querySelector(sel); }
      var kodEl = q('[name="kodWydzialuInput"]') || q('[name="kodWydzialu"]') || q('#kodWydzialuInput') || q('#kodWydzialu');
      var nrEl = q('[name="numerKsiegiWieczystej"]') || q('[name="nrKsiegiWieczystej"]') || q('[name="nrKw"]') || q('#numerKsiegiWieczystej') || q('#nrKw');
      var cyfraEl = q('[name="cyfraKontrolna"]') || q('[name="cyfraK"]') || q('#cyfraKontrolna') || q('#cyfraK');
      if (!(setVal(kodEl, kod) && setVal(nrEl, nr) && setVal(cyfraEl, cyfra))) return false;
      var captcha = q('[name="captcha"]') || q('#captcha') || q('input[name*="aptcha" i]');
      if (captcha && !String(captcha.value || '').trim()) {
        window.__ekwNeedsCaptcha = true;
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('captcha');
        return 'captcha';
      }
      var btn = q('input[type="submit"][value*="Szukaj" i]') || q('input[type="button"][value*="Szukaj" i]');
      if (!btn) {
        var nodes = document.querySelectorAll('button, input[type="submit"], input[type="button"], a');
        for (var i = 0; i < nodes.length; i++) {
          var label = String(nodes[i].textContent || nodes[i].value || '').toLowerCase();
          if (label.indexOf('szukaj') >= 0 || label.indexOf('wyszukaj') >= 0) { btn = nodes[i]; break; }
        }
      }
      if (btn) { btn.click(); return 'search'; }
      return 'filled';
    } catch (e) { return false; }
  })(); true;`;
}

export function buildEkwOpenBookScript(): string {
  return `(function(){
    try {
      var nodes = document.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      for (var i = 0; i < nodes.length; i++) {
        var label = String(nodes[i].textContent || nodes[i].value || '').toLowerCase();
        if (
          label.indexOf('przegląd') >= 0 ||
          label.indexOf('przeglad') >= 0 ||
          label.indexOf('aktualnej tre') >= 0 ||
          label.indexOf('treść kw') >= 0 ||
          label.indexOf('tresc kw') >= 0
        ) {
          nodes[i].click();
          return true;
        }
      }
      return false;
    } catch (e) { return false; }
  })(); true;`;
}

export function isEkwSearchPageUrl(url: string): boolean {
  return /wyszukiwanieKW/i.test(url);
}

export function isEkwBookContentUrl(url: string): boolean {
  return /pokazWydruk|pokazTre|podglad|dzial/i.test(url);
}

export function isEkwResultsPageUrl(url: string): boolean {
  return /KsiegiWieczyste/i.test(url) && !isEkwSearchPageUrl(url) && !isEkwBookContentUrl(url);
}
