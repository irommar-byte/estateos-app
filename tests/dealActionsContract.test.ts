import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd());

test('WWW deals actions delegates to the shared executeDealAction', () => {
  const src = readFileSync(join(root, 'src/app/api/deals/[id]/actions/route.ts'), 'utf8');
  assert.match(src, /executeDealAction/);
  assert.match(src, /resolveDealUserId/);
});

test('legacy /api/bids proposes through executeDealAction BID_PROPOSE', () => {
  const src = readFileSync(join(root, 'src/app/api/bids/route.ts'), 'utf8');
  assert.match(src, /executeDealAction/);
  assert.match(src, /BID_PROPOSE/);
});

test('mobile deal actions emit canonical DEAL_EVENT payloads', () => {
  const src = readFileSync(
    join(root, 'src/app/api/mobile/v1/deals/[id]/actions/route.ts'),
    'utf8',
  );
  assert.match(src, /\[\[DEAL_EVENT\]\]/);
  assert.match(src, /export async function executeDealAction/);
  assert.match(src, /export async function POST/);
});
