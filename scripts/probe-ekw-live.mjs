/**
 * Live probe: portal EKW reachable + classifies challenge vs form.
 * Full human hCaptcha cannot be bypassed — verifies in-app URL + gate heuristics.
 *
 * Usage: npx tsx scripts/probe-ekw-live.mjs
 */
import {
  EKW_SEARCH_URL,
  classifyEkwUrl,
  parseLandRegistryForEkw,
  shouldLoadEkwUrlInWebView,
} from '../src/utils/ekwBrowser.ts';

const SAMPLE = 'WA2M/00446032/2';

async function main() {
  const parts = parseLandRegistryForEkw(SAMPLE);
  if (!parts) {
    console.error('FAIL parse', SAMPLE);
    process.exit(1);
  }

  console.log('KW', parts);
  console.log('search URL', EKW_SEARCH_URL);
  console.log('classify', classifyEkwUrl(EKW_SEARCH_URL));
  console.log('in-webview', shouldLoadEkwUrlInWebView(EKW_SEARCH_URL));

  const ua =
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  const res = await fetch(EKW_SEARCH_URL, {
    headers: {
      'User-Agent': ua,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pl-PL,pl;q=0.9',
    },
    redirect: 'follow',
  });

  const html = await res.text();
  const lower = html.toLowerCase();
  const challenge =
    lower.includes('incapsula') ||
    lower.includes('hcaptcha') ||
    lower.includes('i am human') ||
    lower.includes('additional security check') ||
    lower.includes('main-iframe');
  const hasForm =
    /kodWydzialuInput|name=["']kodWydzialu/.test(html) &&
    /numerKw|numerKsiegiWieczystej|numerKW/.test(html);

  console.log('HTTP', res.status, 'bytes', html.length);
  console.log('final URL', res.url);
  console.log('challenge', challenge);
  console.log('hasForm', hasForm);

  if (!res.ok && res.status !== 403) {
    console.error('FAIL unexpected HTTP', res.status);
    process.exit(1);
  }

  // Success criteria for automated probe:
  // - portal responds
  // - URL stays classified as search / in-webview
  // - either form ready OR Imperva challenge (both handled in-app)
  if (!shouldLoadEkwUrlInWebView(res.url || EKW_SEARCH_URL)) {
    console.error('FAIL would escape WebView');
    process.exit(1);
  }
  if (!challenge && !hasForm) {
    console.error('FAIL neither challenge nor form detected');
    process.exit(1);
  }

  console.log(
    challenge
      ? 'OK: Imperva/hCaptcha gate — app shows checkbox in okienko, then autofill→księga'
      : 'OK: form visible — app autofills KW and opens book in okienko',
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
