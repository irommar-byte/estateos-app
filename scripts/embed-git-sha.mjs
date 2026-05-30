#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const target = path.join(ROOT, 'src/releaseBuildMarker.ts');

let sha = 'unknown';
try {
  sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
} catch {
  /* ignore */
}

const fingerprint = `EOS_RELEASE_FP_${sha}`;

const contents = `/** Updated by scripts/embed-git-sha.mjs — npm run verify:ios-release przed Archive. */
export const EMBEDDED_BUILD_GIT_SHA = '${sha}';
export const RELEASE_BUILD_FINGERPRINT = '${fingerprint}';
`;

fs.writeFileSync(target, contents, 'utf8');
console.log(`[embed-git-sha] ${fingerprint} → src/releaseBuildMarker.ts`);
