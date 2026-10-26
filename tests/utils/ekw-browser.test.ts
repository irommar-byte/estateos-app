import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  advanceEkwViewerFlow,
  buildEkwAutofillScript,
  buildEkwGateWatchScript,
  buildEkwOpenBookScript,
  buildEkwSearchUrl,
  buildEkwSubmitSearchScript,
  classifyEkwUrl,
  EKW_SEARCH_URL,
  parseLandRegistryForEkw,
  resolveEkwStatusAfterMessage,
  shouldLoadEkwUrlInWebView,
} from '../../src/utils/ekwBrowser';

const SAMPLE_KW = 'WA2M/00446032/2';
const PARTS = parseLandRegistryForEkw(SAMPLE_KW)!;

describe('ekwBrowser — parse KW', () => {
  it('parses WA2M/00446032/2 into court / number / check digit', () => {
    assert.deepEqual(PARTS, {
      kodWydzialu: 'WA2M',
      nrKw: '00446032',
      cyfraK: '2',
    });
  });

  it('normalizes lowercase and rejects garbage', () => {
    assert.equal(parseLandRegistryForEkw('wa2m/00446032/2')?.kodWydzialu, 'WA2M');
    assert.equal(parseLandRegistryForEkw('WA2M-00446032-2'), null);
    assert.equal(parseLandRegistryForEkw(''), null);
    assert.equal(parseLandRegistryForEkw('NOT-A-KW'), null);
  });
});

describe('ekwBrowser — URL classification', () => {
  it('uses plain search URL (no query — Imperva-safe)', () => {
    assert.equal(buildEkwSearchUrl(PARTS), EKW_SEARCH_URL);
    assert.ok(!buildEkwSearchUrl(PARTS).includes('?'));
  });

  it('classifies search / results / book URLs', () => {
    assert.equal(
      classifyEkwUrl('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wyszukiwanieKW'),
      'search',
    );
    assert.equal(
      classifyEkwUrl('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wynikiWyszukiwania'),
      'results',
    );
    assert.equal(
      classifyEkwUrl('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/pokazWydruk'),
      'book',
    );
    assert.equal(
      classifyEkwUrl('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/aktualnaTrescKW'),
      'book',
    );
  });
});

describe('ekwBrowser — stay in WebView (never Safari)', () => {
  it('allows EKW + bot-check hosts in-app', () => {
    assert.equal(shouldLoadEkwUrlInWebView(EKW_SEARCH_URL), true);
    assert.equal(
      shouldLoadEkwUrlInWebView('https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/pokazWydruk'),
      true,
    );
    assert.equal(shouldLoadEkwUrlInWebView('https://newassets.hcaptcha.com/captcha/v1/challenge'), true);
    assert.equal(shouldLoadEkwUrlInWebView('about:blank'), true);
  });

  it('blocks unrelated schemes that would escape to Safari', () => {
    assert.equal(shouldLoadEkwUrlInWebView('https://maps.apple.com/?q=Warsaw'), false);
    assert.equal(shouldLoadEkwUrlInWebView('itms-apps://itunes.apple.com/app/id123'), false);
    assert.equal(shouldLoadEkwUrlInWebView('https://evil.example.com/phish'), false);
  });
});

describe('ekwBrowser — scripts for in-window fill → book', () => {
  it('gate watch posts challenge/ready and watches Imperva/hCaptcha', () => {
    const script = buildEkwGateWatchScript();
    assert.match(script, /ekw:challenge/);
    assert.match(script, /ekw:ready/);
    assert.match(script, /incapsula|hcaptcha/i);
    assert.match(script, /kodWydzialuInput/);
  });

  it('autofill embeds KW parts and can submit Szukaj', () => {
    const script = buildEkwAutofillScript(PARTS, { submit: true });
    assert.match(script, /WA2M/);
    assert.match(script, /00446032/);
    assert.match(script, /"2"/);
    assert.match(script, /doSubmit=true/);
    assert.match(script, /ekw:ok/);
    assert.match(script, /wyszukaj|Szukaj/i);
  });

  it('submit + open-book scripts stay on EKW labels', () => {
    const submit = buildEkwSubmitSearchScript(PARTS);
    const open = buildEkwOpenBookScript();
    assert.match(submit, /WA2M/);
    assert.match(submit, /wyszukaj|szukaj/i);
    assert.match(open, /przegl[aą]d|tresc|treść|wydruk|pokazWydruk/i);
  });
});

describe('ekwBrowser — status messages', () => {
  it('maps gate/autofill messages to Polish hints', () => {
    assert.equal(resolveEkwStatusAfterMessage('ekw:challenge', PARTS).kind, 'challenge');
    assert.equal(resolveEkwStatusAfterMessage('ekw:ready', PARTS).kind, 'ready');
    assert.match(resolveEkwStatusAfterMessage('ekw:ready', PARTS).hint, /WA2M\/00446032\/2/);
    assert.equal(resolveEkwStatusAfterMessage('ekw:ok', PARTS).kind, 'ok');
    assert.equal(resolveEkwStatusAfterMessage('ekw:kod_missing', PARTS).kind, 'kod_missing');
    assert.equal(resolveEkwStatusAfterMessage('captcha', PARTS).kind, 'captcha');
    assert.equal(resolveEkwStatusAfterMessage('noise', PARTS).kind, 'ignore');
  });
});

describe('ekwBrowser — full in-app flow to księga (state machine)', () => {
  it('challenge → ready → ok → results → book; always staysInApp', () => {
    let step = advanceEkwViewerFlow({
      phase: 'loading',
      url: EKW_SEARCH_URL,
      parts: PARTS,
    });
    assert.equal(step.staysInApp, true);
    assert.deepEqual(step.actions, ['gate']);

    step = advanceEkwViewerFlow({
      phase: 'loading',
      message: 'ekw:challenge',
      parts: PARTS,
    });
    assert.equal(step.phase, 'challenge');
    assert.equal(step.staysInApp, true);

    step = advanceEkwViewerFlow({
      phase: 'challenge',
      message: 'ekw:ready',
      parts: PARTS,
    });
    assert.equal(step.phase, 'filling');
    assert.deepEqual(step.actions, ['autofill']);

    step = advanceEkwViewerFlow({
      phase: 'filling',
      message: 'ekw:ok',
      parts: PARTS,
    });
    assert.equal(step.phase, 'searching');
    assert.deepEqual(step.actions, ['submit']);

    step = advanceEkwViewerFlow({
      phase: 'searching',
      url: 'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/wynikiWyszukiwania',
      parts: PARTS,
    });
    assert.equal(step.phase, 'results');
    assert.deepEqual(step.actions, ['openBook']);

    step = advanceEkwViewerFlow({
      phase: 'results',
      url: 'https://przegladarka-ekw.ms.gov.pl/eukw_prz/KsiegiWieczyste/pokazWydruk?nr=1',
      parts: PARTS,
    });
    assert.equal(step.phase, 'book');
    assert.match(step.hint, /Księga wieczysta/i);
    assert.equal(step.staysInApp, true);
    assert.deepEqual(step.actions, []);
  });

  it('network drop (−1005) retries in-window, never Safari', () => {
    const step = advanceEkwViewerFlow({
      phase: 'loading',
      loadError: true,
      parts: PARTS,
    });
    assert.equal(step.phase, 'error');
    assert.deepEqual(step.actions, ['retry']);
    assert.equal(step.staysInApp, true);
    assert.match(step.hint, /okienku/i);
  });
});

describe('ekwBrowser — source policy: no Safari CTA for EKW', () => {
  it('EkwBookViewerModal has no Linking.openURL / Safari button', () => {
    const modal = readFileSync(
      join(process.cwd(), 'src/components/admin/EkwBookViewerModal.tsx'),
      'utf8',
    );
    assert.equal(modal.includes('Linking.openURL'), false);
    assert.equal(modal.includes('Otwórz w Safari'), false);
    assert.match(modal, /shouldLoadEkwUrlInWebView/);
    assert.match(modal, /setSupportMultipleWindows=\{false\}/);
    assert.match(modal, /onOpenWindow/);
  });

  it('AcquisitionKwField and AgencyClientDetail open modal, not Safari for KW', () => {
    const field = readFileSync(
      join(process.cwd(), 'src/components/agency/AcquisitionKwField.tsx'),
      'utf8',
    );
    const detail = readFileSync(
      join(process.cwd(), 'src/screens/AgencyClientDetailScreen.tsx'),
      'utf8',
    );
    assert.equal(field.includes('przegladarka-ekw.ms.gov.pl'), false);
    assert.equal(field.includes('Linking.openURL'), false);
    assert.match(field, /setEkwOpen\(true\)/);
    assert.match(field, /EkwBookViewerModal/);

    assert.equal(
      detail.includes("Linking.openURL('https://przegladarka-ekw.ms.gov.pl"),
      false,
    );
    assert.match(detail, /setEkwViewerKw/);
    assert.match(detail, /EkwBookViewerModal/);
  });
});

describe('ekwBrowser — DOM simulation: fill form and open book', () => {
  it('open-book script clicks „Przeglądanie księgi” link', () => {
    // Minimal DOM shim for script evaluation
    const clicks: string[] = [];
    const link = {
      textContent: 'Przeglądanie księgi wieczystej',
      value: '',
      href: '/eukw_prz/KsiegiWieczyste/pokazWydruk',
      click() {
        clicks.push('book');
      },
    };
    const document = {
      querySelectorAll(sel: string) {
        if (sel.includes('pokazWydruk')) return [link];
        if (sel === 'a, button, input[type="button"], input[type="submit"]') return [link];
        return [];
      },
    };
    const script = buildEkwOpenBookScript()
      .replace(/\(function\(\)\{/, 'return (function(){')
      .replace(/\}\)\(\); true;$/, '})();');
    // eslint-disable-next-line no-new-func
    const run = new Function('document', script);
    const ok = run(document);
    assert.equal(ok, true);
    assert.deepEqual(clicks, ['book']);
  });

  it('autofill script fills court + number + check digit then posts ekw:ok', () => {
    const posts: string[] = [];
    const fields: Record<string, { value: string; tagName: string; focus?: () => void; dispatchEvent?: () => void; options?: { value: string; text: string }[]; selectedIndex?: number }> = {
      kodWydzialuInput: { value: '', tagName: 'INPUT', focus() {}, dispatchEvent() {} },
      numerKw: { value: '', tagName: 'INPUT', focus() {}, dispatchEvent() {} },
      cyfraKontrolna: { value: '', tagName: 'INPUT', focus() {}, dispatchEvent() {} },
      kodWydzialu: {
        value: '',
        tagName: 'SELECT',
        options: [{ value: 'WA2M', text: 'WA2M - Sąd' }],
        selectedIndex: -1,
        dispatchEvent() {},
      },
    };
    const document = {
      getElementById: () => null,
      documentElement: { innerHTML: '<form>ekw search</form>' },
      querySelector(sel: string) {
        if (sel.includes('kodWydzialuInput')) return fields.kodWydzialuInput;
        if (sel.includes('#kodWydzialu') || sel.includes('name="kodWydzialu"')) return fields.kodWydzialu;
        if (sel.includes('numerKw') || sel.includes('numerKW')) return fields.numerKw;
        if (sel.includes('cyfraKontrolna') || sel.includes('cyfraK')) return fields.cyfraKontrolna;
        if (sel.includes('captcha')) return null;
        if (sel.includes('wyszukaj') || sel.includes('Szukaj')) return { click() { posts.push('submit'); } };
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
    const windowObj: Record<string, unknown> = {
      ReactNativeWebView: { postMessage: (m: string) => posts.push(String(m)) },
      HTMLInputElement: { prototype: {} },
      HTMLTextAreaElement: { prototype: {} },
      Event: class {
        constructor(public type: string) {}
      },
      KeyboardEvent: class {
        constructor(public type: string) {}
      },
      MouseEvent: class {
        constructor(public type: string) {}
      },
      jQuery: undefined,
    };

    const raw = buildEkwAutofillScript(PARTS, { submit: false });
    // Strip trailing `true;` used for WebView inject
    const body = raw.replace(/\s*true;\s*$/, '');
    // eslint-disable-next-line no-new-func
    const run = new Function('window', 'document', `with(window){ ${body} }`);
    run(windowObj, document);

    // Immediate fill + deferred courtOk / ekw:ok (380ms)
    assert.equal(fields.numerKw.value, '00446032');
    assert.equal(fields.cyfraKontrolna.value, '2');

    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        try {
          assert.ok(posts.includes('ekw:ok'), `expected ekw:ok in ${JSON.stringify(posts)}`);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 500);
    });
  });
});
