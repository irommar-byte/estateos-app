/**
 * HDR image delete smoke — upload artifacts → delete → verify cleanup.
 * Run: npx tsx scripts/hdr-image-delete-smoke.ts
 */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'eos-hdr-del-'));
  process.env.OFFER_UPLOAD_ROOT = tmpRoot;

  const offerId = 999001;
  const fileStem = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  const offerDir = path.join(tmpRoot, String(offerId));
  const metaDir = path.join(offerDir, 'meta');
  await fs.mkdir(metaDir, { recursive: true });

  const sdrName = `${fileStem}.webp`;
  const masterName = `${fileStem}-master.heic`;
  const sdrPath = path.join(offerDir, sdrName);
  const masterPath = path.join(offerDir, masterName);
  const metaPath = path.join(metaDir, `${fileStem}.json`);

  const publicSdr = `/uploads/offers/${offerId}/${sdrName}`;
  const publicMaster = `/uploads/offers/${offerId}/${masterName}`;

  await fs.writeFile(sdrPath, Buffer.from('fake-sdr-webp'));
  await fs.writeFile(masterPath, Buffer.from('fake-hdr-master-heic'));
  await fs.writeFile(
    metaPath,
    JSON.stringify({
      isHdr: true,
      sdrUrl: publicSdr,
      masterUrl: publicMaster,
      hdrDisplayUrl: publicMaster,
      masterMime: 'image/heic',
      detectedAt: new Date().toISOString(),
    }),
  );

  const wrongOfferUrl = `/uploads/offers/${offerId + 1}/${sdrName}`;
  const { deleteOfferImageArtifacts, resolveOfferImageFsPath } = await import(
    '../src/lib/upload/deleteOfferImageArtifacts'
  );

  try {
    await deleteOfferImageArtifacts(offerId, wrongOfferUrl);
    console.error('FAIL: delete allowed cross-offer URL');
    process.exit(1);
  } catch {
    console.log('Cross-offer URL blocked: OK');
  }

  if (!resolveOfferImageFsPath(offerId, publicSdr)) {
    console.error('FAIL: resolveOfferImageFsPath');
    process.exit(1);
  }

  const result = await deleteOfferImageArtifacts(offerId, publicSdr);
  if (!result.deleted.length) {
    console.error('FAIL: nothing deleted', result);
    process.exit(1);
  }

  for (const p of [sdrPath, masterPath, metaPath]) {
    if (await fileExists(p)) {
      console.error('FAIL: artifact still exists:', p);
      process.exit(1);
    }
  }

  // Idempotent — missing files safe
  const again = await deleteOfferImageArtifacts(offerId, publicSdr);
  if (again.deleted.length > 0) {
    console.error('FAIL: second delete should not remove files');
    process.exit(1);
  }

  console.log('Deleted:', result.deleted.map((p) => path.basename(p)).join(', '));
  console.log('\nHDR image delete smoke: PASS');

  await fs.rm(tmpRoot, { recursive: true, force: true });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
