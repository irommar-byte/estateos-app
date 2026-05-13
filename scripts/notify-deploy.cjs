#!/usr/bin/env node
/**
 * Discord lub Slack incoming webhook po deployu (serwer lub CI).
 * Ustaw jeden z: DISCORD_WEBHOOK_URL | SLACK_WEBHOOK_URL | GENERIC_WEBHOOK_URL
 *
 * Env (typowe, ustawiane z deploy-prod.sh / GitHub Actions):
 *   DEPLOY_STATUS, DEPLOY_SHA, DEPLOY_BRANCH, DEPLOY_DURATION_SEC, DEPLOY_EXIT,
 *   DEPLOY_ROLLBACK_HINT, DEPLOY_URL / DEPLOY_PUBLIC_URL (np. https://estateos.pl)
 */
const https = require('https');
const http = require('http');

const status = (process.env.DEPLOY_STATUS || 'unknown').toLowerCase();
const sha = (process.env.DEPLOY_SHA || 'unknown').slice(0, 40);
const branch = process.env.DEPLOY_BRANCH || 'unknown';
const duration = String(process.env.DEPLOY_DURATION_SEC ?? '');
const exitCode = process.env.DEPLOY_EXIT || '';
const rollback = process.env.DEPLOY_ROLLBACK_HINT || process.env.DEPLOY_ROLLBACK_SHA || '';
const url = process.env.DEPLOY_URL || process.env.DEPLOY_PUBLIC_URL || 'https://estateos.pl';

const discordUrl = process.env.DISCORD_WEBHOOK_URL;
const slackUrl = process.env.SLACK_WEBHOOK_URL;
const genericUrl = process.env.GENERIC_WEBHOOK_URL;
const webhook = discordUrl || slackUrl || genericUrl;

if (!webhook) {
  process.exit(0);
}

const ok = status === 'success';
const color = ok ? 0x10b981 : 0xef4444;
const title = ok ? 'EstateOS™ deploy OK' : 'EstateOS™ deploy FAILED';

function postDiscord() {
  const body = JSON.stringify({
    embeds: [
      {
        title,
        color,
        fields: [
          { name: 'SHA', value: `\`${sha}\``, inline: true },
          { name: 'Branch', value: branch, inline: true },
          { name: 'Duration (s)', value: duration || 'n/a', inline: true },
          { name: 'Exit', value: String(exitCode || '0'), inline: true },
          { name: 'URL', value: url, inline: false },
          { name: 'Rollback hint', value: rollback || '(see deploy logs / .deploy/recovery/)', inline: false },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  });
  return postJson(discordUrl, body, { 'Content-Type': 'application/json' });
}

function postSlack() {
  const body = JSON.stringify({
    text: `*${title}*\nSHA: \`${sha}\`  branch: *${branch}*  duration: *${duration}s*  exit: *${exitCode}*\n${url}\nRollback: ${rollback || 'n/a'}`,
  });
  return postJson(slackUrl, body, { 'Content-Type': 'application/json' });
}

function postGeneric() {
  const body = JSON.stringify({
    event: 'estateos.deploy',
    status,
    sha,
    branch,
    durationSec: duration,
    exitCode,
    rollback,
    url,
  });
  return postJson(genericUrl, body, { 'Content-Type': 'application/json' });
}

function postJson(targetUrl, body, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      },
      (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`HTTP ${res.statusCode}`));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  try {
    if (discordUrl) await postDiscord();
    else if (slackUrl) await postSlack();
    else if (genericUrl) await postGeneric();
  } catch (e) {
    console.error('notify-deploy:', e.message);
    process.exitCode = 0;
  }
})();
