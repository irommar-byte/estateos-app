/**
 * Przetwarzanie zdjęć z importu OtoDom: ukrycie znaku wodnego (dół / lewy-dolny róg),
 * delikatne transformacje utrudniające wykrywanie duplikatów.
 */
export async function processOtodomImportImageBuffer(
  input: Buffer,
  imageIndex: number,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  let pipeline = sharp(input).rotate();
  const meta = await pipeline.metadata();
  const width = Number(meta.width || 0);
  const height = Number(meta.height || 0);

  if (width > 320 && height > 240) {
    const bottomCrop = Math.min(Math.round(height * 0.095), 120);
    const newHeight = height - bottomCrop;
    if (newHeight > 200) {
      pipeline = sharp(input).rotate().extract({
        left: 0,
        top: 0,
        width,
        height: newHeight,
      });
    }

    const overlayW = Math.min(Math.round(width * 0.32), 420);
    const overlayH = Math.min(Math.round(newHeight * 0.14), 100);
    const gradientSvg = `
      <svg width="${overlayW}" height="${overlayH}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stop-color="rgb(12,12,14)" stop-opacity="0.92"/>
            <stop offset="55%" stop-color="rgb(12,12,14)" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="rgb(12,12,14)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
      </svg>`;

    const cornerOverlay = await sharp(Buffer.from(gradientSvg)).png().toBuffer();
    pipeline = pipeline.composite([{ input: cornerOverlay, gravity: 'southwest' }]);
  }

  if (imageIndex % 2 === 1) {
    pipeline = pipeline.flop();
  }

  const microRotate = imageIndex % 3 === 0 ? 0.12 : imageIndex % 3 === 1 ? -0.1 : 0;
  if (microRotate !== 0) {
    pipeline = pipeline.rotate(microRotate, { background: { r: 16, g: 16, b: 20, alpha: 1 } });
  }

  pipeline = pipeline.modulate({
    brightness: 1.008 + (imageIndex % 4) * 0.004,
    saturation: 0.985 + (imageIndex % 2) * 0.01,
  });

  pipeline = pipeline.sharpen({ sigma: 0.35, m1: 0.4, m2: 0.15 });

  return pipeline.jpeg({ quality: 91, mozjpeg: true }).toBuffer();
}
