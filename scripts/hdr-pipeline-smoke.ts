/**
 * HDR pipeline smoke — detection + SDR fallback generation (no upload).
 * Run: npx tsx scripts/hdr-pipeline-smoke.ts
 */
import { detectHdrImage } from '../src/lib/upload/hdrDetection';
import { generateSdrWebp } from '../src/lib/upload/hdrSdrPipeline';

async function main() {
  const sharp = (await import('sharp')).default;

  // Synthetic wide-gamut PNG (not HDR — should NOT flag as HDR)
  const sdrPng = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .png()
    .toBuffer();
  const sdrResult = await detectHdrImage(sdrPng, 'image/png');
  console.log('SDR PNG isHdr:', sdrResult.isHdr, 'signals:', sdrResult.signals.join(', ') || 'none');
  if (sdrResult.isHdr) {
    console.error('FAIL: plain SDR PNG flagged as HDR');
    process.exit(1);
  }

  // Rec2020 PNG via sharp — should detect wide gamut
  const widePng = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .toColourspace('rec2020')
    .png()
    .toBuffer();
  const wideResult = await detectHdrImage(widePng, 'image/png');
  console.log('Rec2020 PNG isHdr:', wideResult.isHdr, 'signals:', wideResult.signals.join(', '));

  const sdrOut = await generateSdrWebp({ buffer: widePng, tileWatermark: false, maxEdge: 128 });
  if (!sdrOut.buffer.length) {
    console.error('FAIL: SDR fallback empty');
    process.exit(1);
  }
  console.log('SDR fallback bytes:', sdrOut.buffer.length, 'ext:', sdrOut.ext);

  // Ultra HDR marker injection test
  const fakeUltraHdr = Buffer.concat([
    sdrPng,
    Buffer.from('urn:iso:std:iso:ts:21496:-1'),
  ]);
  const ultraResult = await detectHdrImage(fakeUltraHdr, 'image/jpeg');
  console.log('Ultra HDR marker isHdr:', ultraResult.isHdr, 'hasGainMap:', ultraResult.hasGainMap);
  if (!ultraResult.isHdr) {
    console.error('FAIL: Ultra HDR marker not detected');
    process.exit(1);
  }

  console.log('\nHDR pipeline smoke: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
