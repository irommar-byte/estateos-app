#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [sourceRoot, targetRoot] = process.argv.slice(2);
if (!sourceRoot || !targetRoot) {
  console.error('Użycie: node scripts/merge-lineage-user-data.mjs <źródło-data> <cel-data>');
  process.exit(2);
}

const GROUPS = [
  'movies-favorites',
  'movies-library',
  'music-library',
  'music-assets',
  'listening-stats',
];

function newest(left, right, fields) {
  const timestamp = (value) => {
    for (const field of fields) {
      const raw = value?.[field];
      const parsed = typeof raw === 'number' ? raw : Date.parse(String(raw || ''));
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  };
  return timestamp(right) >= timestamp(left) ? { ...left, ...right } : { ...right, ...left };
}

function mergeArray(target, source, keyOf, fields) {
  const merged = new Map();
  for (const item of [...target, ...source]) {
    const key = keyOf(item);
    if (!key) continue;
    const current = merged.get(key);
    merged.set(key, current ? newest(current, item, fields) : item);
  }
  return [...merged.values()];
}

function mergeDocument(group, target, source) {
  if (group === 'movies-favorites') {
    return mergeArray(
      Array.isArray(target) ? target : [],
      Array.isArray(source) ? source : [],
      (item) => item?.id || item?.url,
      ['addedAt'],
    );
  }
  if (group === 'movies-library') {
    return {
      ...target,
      ...source,
      downloads: mergeArray(
        target?.downloads || [],
        source?.downloads || [],
        (item) => item?.url || item?.filename || item?.downloadJobId,
        ['downloadedAt'],
      ),
    };
  }
  if (group === 'music-library') {
    return {
      ...target,
      ...source,
      folders: mergeArray(
        target?.folders || [],
        source?.folders || [],
        (item) => item?.id || item?.applePlaylistId || item?.name,
        ['updatedAt', 'createdAt'],
      ),
      tracks: mergeArray(
        target?.tracks || [],
        source?.tracks || [],
        (item) => item?.id || `${item?.folderId || ''}|${item?.url || ''}`,
        ['addedAt', 'downloadedAt', 'syncAddedAt'],
      ),
    };
  }
  if (group === 'music-assets') {
    return {
      ...target,
      ...source,
      version: Math.max(Number(target?.version || 0), Number(source?.version || 0)),
      updatedAt: Math.max(Number(target?.updatedAt || 0), Number(source?.updatedAt || 0)),
      assets: mergeArray(
        target?.assets || [],
        source?.assets || [],
        (item) => item?.assetId || item?.canonicalKey || item?.relativePath,
        ['acquiredAt'],
      ),
    };
  }
  if (group === 'listening-stats') {
    const recordsByKey = new Map();
    for (const item of [...(target?.records || []), ...(source?.records || [])]) {
      const key = `${item?.url || ''}|${item?.folderId || ''}`;
      const current = recordsByKey.get(key);
      if (!current) {
        recordsByKey.set(key, item);
        continue;
      }
      const merged = newest(current, item, ['lastPlayedAt']);
      recordsByKey.set(key, {
        ...merged,
        firstPlayedAt:
          [current.firstPlayedAt, item.firstPlayedAt].filter(Boolean).sort()[0] || null,
        playCount: Math.max(Number(current.playCount || 0), Number(item.playCount || 0)),
        totalListenSeconds: Math.max(
          Number(current.totalListenSeconds || 0),
          Number(item.totalListenSeconds || 0),
        ),
        eveningPlayCount: Math.max(
          Number(current.eveningPlayCount || 0),
          Number(item.eveningPlayCount || 0),
        ),
        playTimestamps: [
          ...new Set([...(current.playTimestamps || []), ...(item.playTimestamps || [])]),
        ].sort(),
      });
    }
    const records = [...recordsByKey.values()];
    return {
      ...target,
      ...source,
      updatedAt: Math.max(Number(target?.updatedAt || 0), Number(source?.updatedAt || 0)),
      records,
    };
  }
  throw new Error(`Nieobsługiwana grupa: ${group}`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    fs.copyFileSync(file, `${file}.pre-estateos-migration`);
  }
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

let filesMerged = 0;
for (const group of GROUPS) {
  const sourceDirectory = path.join(sourceRoot, group);
  if (!fs.existsSync(sourceDirectory)) continue;
  for (const name of fs.readdirSync(sourceDirectory)) {
    if (!name.endsWith('.json')) continue;
    const sourceFile = path.join(sourceDirectory, name);
    const targetFile = path.join(targetRoot, group, name);
    const source = readJson(sourceFile);
    const target = fs.existsSync(targetFile) ? readJson(targetFile) : null;
    writeAtomic(targetFile, target == null ? source : mergeDocument(group, target, source));
    filesMerged += 1;
  }
}

console.log(JSON.stringify({ ok: true, filesMerged }));
