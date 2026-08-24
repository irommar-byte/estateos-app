const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const envPath = path.join(process.cwd(), '.env');
const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const hasPublic = /^WEB_PUSH_PUBLIC_KEY=.+$/m.test(current);
const hasPrivate = /^WEB_PUSH_PRIVATE_KEY=.+$/m.test(current);

if (hasPublic && hasPrivate) {
  console.log('[web-push] VAPID keys already configured.');
  process.exit(0);
}

if (hasPublic !== hasPrivate) {
  console.error('[web-push] Incomplete VAPID configuration. Set both WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY.');
  process.exit(1);
}

const keys = webpush.generateVAPIDKeys();
const suffix = [
  '',
  '# EstateOS client portal Web Push (generated once on server)',
  `WEB_PUSH_PUBLIC_KEY=${keys.publicKey}`,
  `WEB_PUSH_PRIVATE_KEY=${keys.privateKey}`,
  'WEB_PUSH_SUBJECT=mailto:powiadomienia@estateos.pl',
  '',
].join('\n');

fs.appendFileSync(envPath, suffix, { encoding: 'utf8', mode: 0o600 });
console.log('[web-push] Generated persistent VAPID keys in server .env.');
