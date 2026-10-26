/** Oficjalna przeglądarka EKW — Imperva/hCaptcha + formularz KW. */
export const EKW_SEARCH_URL =
  'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW';

export type EkwRegistryParts = {
  kodWydzialu: string;
  nrKw: string;
  cyfraK: string;
};

export type EkwPageKind = 'challenge' | 'search' | 'results' | 'book' | 'unknown';

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

/** Bootstrap URL — portal czasem łapie query w Impervie; preferujemy czysty URL + JS fill. */
export function buildEkwSearchUrl(_parts: EkwRegistryParts): string {
  return EKW_SEARCH_URL;
}

export function isEkwSearchPageUrl(url: string): boolean {
  return /wyszukiwanieKW/i.test(url);
}

export function isEkwBookContentUrl(url: string): boolean {
  return /pokazWydruk|pokazTre|podglad|dzial|aktualnaTresc|trescKw/i.test(url);
}

export function isEkwResultsPageUrl(url: string): boolean {
  return /KsiegiWieczyste/i.test(url) && !isEkwSearchPageUrl(url) && !isEkwBookContentUrl(url);
}

export function classifyEkwUrl(url: string): EkwPageKind {
  if (isEkwBookContentUrl(url)) return 'book';
  if (isEkwSearchPageUrl(url)) return 'search';
  if (isEkwResultsPageUrl(url)) return 'results';
  return 'unknown';
}

/**
 * Poller: Imperva/hCaptcha vs gotowy formularz wyszukiwania.
 * Posts: ekw:challenge | ekw:ready | ekw:ok | ekw:kod_missing | captcha
 */
export function buildEkwGateWatchScript(): string {
  return `(function(){
    try {
      if (window.__ekwGateWatch) return true;
      window.__ekwGateWatch = true;
      function post(msg) {
        try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(msg)); } catch (e) {}
      }
      function isChallenge() {
        var html = String(document.documentElement && document.documentElement.innerHTML || '').toLowerCase();
        if (html.indexOf('incapsula') >= 0 || html.indexOf('_incapsula_resource') >= 0) return true;
        if (html.indexOf('hcaptcha') >= 0 || html.indexOf('i am human') >= 0) return true;
        if (html.indexOf('additional security check') >= 0) return true;
        if (document.getElementById('main-iframe')) {
          var src = String(document.getElementById('main-iframe').getAttribute('src') || '');
          if (src.indexOf('Incapsula') >= 0 || src.indexOf('SWUDNSAI') >= 0) return true;
        }
        return false;
      }
      function hasForm() {
        var kod = document.querySelector('#kodWydzialuInput, [name="kodWydzialuInput"], #kodWydzialu, [name="kodWydzialu"]');
        var nr = document.querySelector('[name="numerKw"], #numerKW, #numerKsiegiWieczystej, [name="numerKsiegiWieczystej"]');
        return !!(kod && nr);
      }
      var last = '';
      function tick() {
        var next = isChallenge() ? 'challenge' : (hasForm() ? 'ready' : 'wait');
        if (next !== last) {
          last = next;
          if (next === 'challenge') post('ekw:challenge');
          if (next === 'ready') post('ekw:ready');
        }
      }
      tick();
      setInterval(tick, 700);
      return true;
    } catch (e) { return false; }
  })(); true;`;
}

/**
 * Fill KW fields. Does NOT click Szukaj unless `submit` is true AND court code verified.
 * Posts: ekw:ok | ekw:kod_missing | captcha
 */
export function buildEkwAutofillScript(parts: EkwRegistryParts, opts?: { submit?: boolean }): string {
  const kod = JSON.stringify(parts.kodWydzialu);
  const nr = JSON.stringify(parts.nrKw);
  const cyfra = JSON.stringify(parts.cyfraK);
  const submit = opts?.submit === true;

  return `(function(){
    try {
      var kod=${kod}, nr=${nr}, cyfra=${cyfra}, doSubmit=${submit ? 'true' : 'false'};
      function q(sel) { return document.querySelector(sel); }
      function post(msg) {
        try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(msg)); } catch (pe) {}
      }
      function isChallenge() {
        var html = String(document.documentElement && document.documentElement.innerHTML || '').toLowerCase();
        if (html.indexOf('incapsula') >= 0 || html.indexOf('hcaptcha') >= 0) return true;
        if (document.getElementById('main-iframe')) return true;
        return false;
      }
      if (isChallenge()) { post('ekw:challenge'); return false; }
      function setNative(el, v) {
        if (!el) return false;
        try {
          var proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
          var desc = Object.getOwnPropertyDescriptor(proto, 'value');
          if (desc && desc.set) desc.set.call(el, v);
          else el.value = v;
        } catch (e) { el.value = v; }
        el.focus && el.focus();
        try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e1) {}
        try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e2) {}
        try { el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' })); } catch (e3) {}
        return true;
      }
      function setSelect(sel, v) {
        if (!sel) return false;
        var upper = String(v).toUpperCase();
        if (sel.tagName === 'SELECT') {
          var found = -1;
          for (var i = 0; i < sel.options.length; i++) {
            var ov = String(sel.options[i].value || '').toUpperCase();
            var ot = String(sel.options[i].text || '').toUpperCase();
            if (ov === upper || ot.indexOf(upper) === 0 || ot.indexOf(upper + ' ') === 0 || ot.indexOf(upper + '-') === 0) {
              found = i; break;
            }
          }
          if (found < 0) {
            for (var j = 0; j < sel.options.length; j++) {
              if (String(sel.options[j].text || '').toUpperCase().indexOf(upper) >= 0) { found = j; break; }
            }
          }
          if (found < 0) return false;
          sel.selectedIndex = found;
          sel.value = sel.options[found].value;
          try { sel.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
          return true;
        }
        return setNative(sel, v);
      }
      function courtOk() {
        var select = q('#kodWydzialu') || q('select[name="kodWydzialu"]') || q('[name="kodWydzialu"]');
        var input = q('#kodWydzialuInput') || q('[name="kodWydzialuInput"]');
        var sv = select ? String(select.value || '').toUpperCase().trim() : '';
        var iv = input ? String(input.value || '').toUpperCase().trim() : '';
        if (sv === kod || sv.indexOf(kod) === 0) return true;
        if (iv === kod || iv.indexOf(kod) === 0) return true;
        return false;
      }
      function fillCourt() {
        var select = q('#kodWydzialu') || q('select[name="kodWydzialu"]') || q('[name="kodWydzialu"]');
        var input = q('#kodWydzialuInput') || q('[name="kodWydzialuInput"]');
        var okSelect = setSelect(select, kod);
        var okInput = setNative(input, kod);
        if (window.jQuery && input) {
          try {
            var $ = window.jQuery;
            $(input).val(kod).trigger('input').trigger('keydown').trigger('keyup').trigger('change');
            try { $(input).autocomplete('search', kod); } catch (ae) {}
          } catch (je) {}
        }
        var items = document.querySelectorAll('.ui-autocomplete li, .ui-menu-item, .ui-autocomplete .ui-menu-item-wrapper');
        for (var k = 0; k < items.length; k++) {
          var t = String(items[k].textContent || '').toUpperCase();
          if (t.indexOf(kod) === 0 || t.indexOf(kod + ' ') >= 0 || t.indexOf(kod + '-') >= 0) {
            items[k].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            items[k].click();
            break;
          }
        }
        return okSelect || okInput || courtOk();
      }
      function fillNumber() {
        var nrEl = q('[name="numerKw"]') || q('[name="numerKsiegiWieczystej"]') || q('[name="nrKsiegiWieczystej"]') || q('[name="nrKw"]') || q('#numerKsiegiWieczystej') || q('#nrKw') || q('#numerKW');
        var cyfraEl = q('[name="cyfraKontrolna"]') || q('[name="cyfraK"]') || q('#cyfraKontrolna') || q('#cyfraK');
        return setNative(nrEl, nr) && setNative(cyfraEl, cyfra);
      }
      if (!q('#kodWydzialuInput') && !q('[name="kodWydzialuInput"]') && !q('#kodWydzialu') && !q('[name="kodWydzialu"]')) {
        post('ekw:challenge');
        return false;
      }
      fillCourt();
      fillNumber();
      setTimeout(function(){ fillCourt(); }, 120);
      setTimeout(function(){
        fillCourt();
        if (!courtOk()) {
          post('ekw:kod_missing');
          return;
        }
        post('ekw:ok');
        var captcha = q('[name="captcha"]') || q('#captcha') || q('input[name*="aptcha" i]');
        if (captcha && !String(captcha.value || '').trim()) {
          window.__ekwNeedsCaptcha = true;
          post('captcha');
          return;
        }
        if (!doSubmit) return;
        var btn = q('input[name="wyszukaj"]') || q('input[type="submit"][value*="Szukaj" i]') || q('input[type="button"][value*="Szukaj" i]') || q('input[type="submit"][value*="WYSZUKAJ" i]');
        if (!btn) {
          var nodes = document.querySelectorAll('button, input[type="submit"], input[type="button"], a');
          for (var i = 0; i < nodes.length; i++) {
            var label = String(nodes[i].textContent || nodes[i].value || '').toLowerCase();
            if (label.indexOf('szukaj') >= 0 || label.indexOf('wyszukaj') >= 0) { btn = nodes[i]; break; }
          }
        }
        if (btn && courtOk()) btn.click();
      }, 380);
      return true;
    } catch (e) {
      try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ekw:kod_missing'); } catch (e2) {}
      return false;
    }
  })(); true;`;
}

/** Click Szukaj only if court code is already filled. */
export function buildEkwSubmitSearchScript(parts: EkwRegistryParts): string {
  const kod = JSON.stringify(parts.kodWydzialu);
  return `(function(){
    try {
      var kod=${kod};
      function q(sel) { return document.querySelector(sel); }
      if (document.getElementById('main-iframe') || String(document.documentElement.innerHTML||'').toLowerCase().indexOf('incapsula')>=0) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ekw:challenge');
        return false;
      }
      var select = q('#kodWydzialu') || q('select[name="kodWydzialu"]') || q('[name="kodWydzialu"]');
      var input = q('#kodWydzialuInput') || q('[name="kodWydzialuInput"]');
      var sv = select ? String(select.value || '').toUpperCase().trim() : '';
      var iv = input ? String(input.value || '').toUpperCase().trim() : '';
      var ok = (sv === kod || sv.indexOf(kod) === 0 || iv === kod || iv.indexOf(kod) === 0);
      if (!ok) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ekw:kod_missing');
        return false;
      }
      var captcha = q('[name="captcha"]') || q('#captcha') || q('input[name*="aptcha" i]');
      if (captcha && !String(captcha.value || '').trim()) {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('captcha');
        return 'captcha';
      }
      var btn = q('input[name="wyszukaj"]') || q('input[type="submit"][value*="Szukaj" i]') || q('input[type="button"][value*="Szukaj" i]');
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
      function clickEl(el) {
        if (!el) return false;
        try { el.click(); return true; } catch (e) { return false; }
      }
      var hrefHints = document.querySelectorAll('a[href*="pokazWydruk"], a[href*="pokazTre"], a[href*="aktualnaTresc"], a[href*="trescKw"], a[href*="podglad"]');
      if (hrefHints.length && clickEl(hrefHints[0])) return true;
      var nodes = document.querySelectorAll('a, button, input[type="button"], input[type="submit"]');
      for (var i = 0; i < nodes.length; i++) {
        var label = String(nodes[i].textContent || nodes[i].value || '').toLowerCase();
        if (
          label.indexOf('przeglądanie księgi') >= 0 ||
          label.indexOf('przegladanie ksiegi') >= 0 ||
          label.indexOf('przegląd') >= 0 ||
          label.indexOf('przeglad') >= 0 ||
          label.indexOf('aktualnej tre') >= 0 ||
          label.indexOf('treść kw') >= 0 ||
          label.indexOf('tresc kw') >= 0 ||
          label.indexOf('treść księgi') >= 0 ||
          label.indexOf('tresc ksiegi') >= 0 ||
          label.indexOf('wydruk') >= 0
        ) {
          if (clickEl(nodes[i])) return true;
        }
      }
      return false;
    } catch (e) { return false; }
  })(); true;`;
}

/** Pure helper for tests / UI: next status after WebView message. */
export function resolveEkwStatusAfterMessage(
  message: string,
  parts: EkwRegistryParts | null,
): { kind: 'challenge' | 'ready' | 'ok' | 'kod_missing' | 'captcha' | 'ignore'; hint: string } {
  if (message === 'ekw:challenge') {
    return {
      kind: 'challenge',
      hint: 'Portal EKW wymaga potwierdzenia „Nie jestem robotem”. Kliknij checkbox w okienku — potem automatycznie uzupełnimy numer KW.',
    };
  }
  if (message === 'ekw:ready') {
    return {
      kind: 'ready',
      hint: parts ? `Formularz gotowy — uzupełniam ${parts.kodWydzialu}/${parts.nrKw}/${parts.cyfraK}…` : 'Formularz gotowy…',
    };
  }
  if (message === 'ekw:ok') {
    return {
      kind: 'ok',
      hint: parts ? `Kod ${parts.kodWydzialu} uzupełniony — szukam księgi…` : 'Numer uzupełniony — szukam księgi…',
    };
  }
  if (message === 'ekw:kod_missing') {
    return {
      kind: 'kod_missing',
      hint: `Nie udało się ustawić kodu wydziału (${parts?.kodWydzialu || '—'}). Wybierz go z listy albo wpisz ręcznie, potem Szukaj.`,
    };
  }
  if (message === 'captcha') {
    return {
      kind: 'captcha',
      hint: 'Wpisz kod z obrazka w formularzu EKW i naciśnij Szukaj — numer KW jest już uzupełniony.',
    };
  }
  return { kind: 'ignore', hint: '' };
}

export type EkwViewerPhase =
  | 'loading'
  | 'challenge'
  | 'filling'
  | 'searching'
  | 'results'
  | 'book'
  | 'error';

export type EkwViewerAction = 'gate' | 'autofill' | 'submit' | 'openBook' | 'retry';

/**
 * Deterministyczna maszyna stanów okienka EKW (bez WebView).
 * Gwarantuje: challenge → fill → submit → results → book — zawsze in-app.
 */
export function advanceEkwViewerFlow(input: {
  phase: EkwViewerPhase;
  message?: string;
  url?: string;
  loadError?: boolean;
  parts: EkwRegistryParts | null;
}): { phase: EkwViewerPhase; actions: EkwViewerAction[]; hint: string; staysInApp: true } {
  if (input.loadError) {
    return {
      phase: 'error',
      actions: ['retry'],
      hint: 'Portal EKW urwał połączenie. Zostajemy w okienku — ponawiamy ładowanie.',
      staysInApp: true,
    };
  }

  if (input.url) {
    const kind = classifyEkwUrl(input.url);
    if (kind === 'book') {
      return {
        phase: 'book',
        actions: [],
        hint: 'Księga wieczysta — przewiń działy I–IV.',
        staysInApp: true,
      };
    }
    if (kind === 'results') {
      return {
        phase: 'results',
        actions: ['openBook'],
        hint: 'Wynik wyszukiwania — otwieram treść KW…',
        staysInApp: true,
      };
    }
    if (kind === 'search') {
      return {
        phase: input.phase === 'searching' ? 'searching' : 'loading',
        actions: ['gate'],
        hint: 'Ładowanie EKW w okienku…',
        staysInApp: true,
      };
    }
  }

  if (input.message) {
    const resolved = resolveEkwStatusAfterMessage(input.message, input.parts);
    if (resolved.kind === 'challenge') {
      return { phase: 'challenge', actions: [], hint: resolved.hint, staysInApp: true };
    }
    if (resolved.kind === 'ready') {
      return { phase: 'filling', actions: ['autofill'], hint: resolved.hint, staysInApp: true };
    }
    if (resolved.kind === 'ok') {
      return { phase: 'searching', actions: ['submit'], hint: resolved.hint, staysInApp: true };
    }
    if (resolved.kind === 'kod_missing') {
      return { phase: 'filling', actions: ['autofill'], hint: resolved.hint, staysInApp: true };
    }
    if (resolved.kind === 'captcha') {
      return { phase: 'filling', actions: [], hint: resolved.hint, staysInApp: true };
    }
  }

  return {
    phase: input.phase,
    actions: [],
    hint: '',
    staysInApp: true,
  };
}

/** Czy URL nawigacji ma zostać w WebView (nigdy Safari). */
export function shouldLoadEkwUrlInWebView(url: string): boolean {
  const trimmed = String(url || '').trim();
  if (!trimmed || trimmed === 'about:blank') return true;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return true;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return (
      host === 'przegladarka-ekw.ms.gov.pl' ||
      host.endsWith('.ms.gov.pl') ||
      host.endsWith('.gov.pl') ||
      host.includes('hcaptcha.com') ||
      host.includes('imperva') ||
      host.includes('incapdns')
    );
  } catch {
    return false;
  }
}
