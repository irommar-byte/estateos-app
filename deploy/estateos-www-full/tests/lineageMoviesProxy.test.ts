import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('Lineage movies API is proxied to the Lineage VM, not EstateOS localhost', () => {
  const site = fs.readFileSync(path.join(process.cwd(), 'deploy/nginx-lineage-site.conf'), 'utf8');
  const upstreams = fs.readFileSync(
    path.join(process.cwd(), 'deploy/nginx-lineage-upstreams.conf'),
    'utf8',
  );
  assert.match(site, /proxy_pass http:\/\/lineage_movies_api;/);
  assert.doesNotMatch(site, /127\.0\.0\.1:4322/);
  assert.match(upstreams, /192\.168\.50\.200:4322/);
});
