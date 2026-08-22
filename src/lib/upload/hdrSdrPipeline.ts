/**
 * SDR fallback z kontrolowanym mapowaniem tonów z wide-gamut / HDR → sRGB.
 * Nie używa CSS brightness — tylko pipeline libvips/sharp.
 */
export async function generateSdrWebp(params: {
  buffer: Buffer;
  tileWatermark?: boolean;
  quality?: number;
  maxEdge?: number;
}): Promise<{ buffer: Buffer; ext: string }> {
  const tileWatermark = params.tileWatermark !== false;
  const quality = Math.min(95, Math.max(70, Number(params.quality) || 82));
  const maxEdge = Math.min(4000, Math.max(1200, Number(params.maxEdge) || 2200));

  try {
    const sharp = (await import('sharp')).default;
    let image = sharp(params.buffer, { failOn: 'none' }).rotate();
    const metadata = await image.metadata();
    const space = String(metadata.space || '').toLowerCase();

    if (space === 'rec2020' || space === 'rec2100' || space === 'p3') {
      image = image.toColourspace('srgb');
    }

    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (width > 0 && height > 0 && (width > maxEdge || height > maxEdge)) {
      image = image.resize({
        width: width >= height ? maxEdge : undefined,
        height: height > width ? maxEdge : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    if (tileWatermark) {
      const svgWatermark = `
      <svg width="520" height="380" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle"
              font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="48"
              fill="rgba(255, 255, 255, 0.20)"
              stroke="rgba(0, 0, 0, 0.08)" stroke-width="1"
              transform="rotate(-25 260 190)">
          EstateOS™
        </text>
      </svg>
    `;
      const watermarkBuffer = await sharp(Buffer.from(svgWatermark)).png().toBuffer();
      image = image.composite([{ input: watermarkBuffer, tile: true, blend: 'over' }]);
    }

    const finalBuffer = await image.webp({ quality, effort: 5 }).toBuffer();
    return { buffer: finalBuffer, ext: '.webp' };
  } catch (e) {
    console.error('generateSdrWebp fallback:', e);
    return { buffer: params.buffer, ext: '.jpg' };
  }
}

/** Zachowuje oryginalny plik HDR bez re-enkode (master). */
export function preserveHdrMasterBuffer(buffer: Buffer): Buffer {
  return Buffer.from(buffer);
}
