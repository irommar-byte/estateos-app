/**
 * Przetwarzanie zdjęć z importu OtoDom: ukrycie znaku wodnego, delikatne transformacje,
 * rozszerzenie pionowych ujęć lustrzanymi, półprzezroczystymi panelami bocznymi.
 */
import type sharp from 'sharp';

const TARGET_LANDSCAPE_ASPECT = 4 / 3;
const MIN_EXTENSION_PAD = 28;

export type OtodomImportImageProcessOptions = {
  /** Rzut lokalu — bez lustrzanego odbicia i agresywnych transformacji. */
  isFloorPlan?: boolean;
};

async function loadSharp() {
  return (await import('sharp')).default;
}

function shouldExtendPortrait(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const aspect = width / height;
  const lowRes = width < 720 || height < 520;
  const portrait = aspect < TARGET_LANDSCAPE_ASPECT - 0.04;
  const oddCrop = aspect < 1.55 && (width < 960 || lowRes);
  return portrait || oddCrop;
}

async function buildFadeMask(
  sharpMod: typeof sharp,
  width: number,
  height: number,
  side: 'left' | 'right',
): Promise<Buffer> {
  const gradient =
    side === 'left'
      ? `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="f" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="white" stop-opacity="0.62"/>
              <stop offset="55%" stop-color="white" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="white" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#f)"/>
        </svg>`
      : `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="f" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stop-color="white" stop-opacity="0.62"/>
              <stop offset="55%" stop-color="white" stop-opacity="0.28"/>
              <stop offset="100%" stop-color="white" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#f)"/>
        </svg>`;

  return sharpMod(Buffer.from(gradient)).png().toBuffer();
}

async function extendWithMirroredWings(
  sharpMod: typeof sharp,
  input: Buffer,
  width: number,
  height: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  if (!shouldExtendPortrait(width, height)) {
    return { buffer: input, width, height };
  }

  const targetWidth = Math.max(width, Math.round(height * TARGET_LANDSCAPE_ASPECT));
  const padTotal = targetWidth - width;
  if (padTotal < MIN_EXTENSION_PAD) {
    return { buffer: input, width, height };
  }

  const padLeft = Math.floor(padTotal / 2);
  const padRight = padTotal - padLeft;
  const stripW = Math.max(20, Math.min(Math.round(width * 0.2), 180, Math.floor(width / 2)));

  const makeWing = async (extractLeft: number, outW: number, side: 'left' | 'right') => {
    const resized = await sharpMod(input)
      .extract({ left: extractLeft, top: 0, width: stripW, height })
      .flop()
      .resize(outW, height, { fit: 'fill' })
      .blur(Math.max(5, Math.round(outW / 36)))
      .modulate({ brightness: 0.8, saturation: 0.9 })
      .ensureAlpha()
      .toBuffer();

    const mask = await buildFadeMask(sharpMod, outW, height, side);
    return sharpMod(resized).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  };

  const leftWing = await makeWing(0, padLeft, 'left');
  const rightWing = await makeWing(Math.max(0, width - stripW), padRight, 'right');

  const composed = await sharpMod({
    create: {
      width: targetWidth,
      height,
      channels: 3,
      background: { r: 14, g: 14, b: 18 },
    },
  })
    .composite([
      { input: leftWing, left: 0, top: 0 },
      { input: rightWing, left: padLeft + width, top: 0 },
      { input, left: padLeft, top: 0 },
    ])
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return { buffer: composed, width: targetWidth, height };
}

async function applyWatermarkMask(
  sharpMod: typeof sharp,
  input: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  if (width <= 320 || height <= 240) return input;

  const bottomCrop = Math.min(Math.round(height * 0.095), 120);
  const newHeight = height - bottomCrop;
  if (newHeight <= 200) return input;

  let pipeline = sharpMod(input).rotate().extract({
    left: 0,
    top: 0,
    width,
    height: newHeight,
  });

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

  const cornerOverlay = await sharpMod(Buffer.from(gradientSvg)).png().toBuffer();
  pipeline = pipeline.composite([{ input: cornerOverlay, gravity: 'southwest' }]);
  return pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function processOtodomImportImageBuffer(
  input: Buffer,
  imageIndex: number,
  options?: OtodomImportImageProcessOptions,
): Promise<Buffer> {
  const sharpMod = await loadSharp();
  const isFloorPlan = options?.isFloorPlan === true;

  if (isFloorPlan) {
    return sharpMod(input)
      .rotate()
      .sharpen({ sigma: 0.25, m1: 0.35, m2: 0.1 })
      .jpeg({ quality: 93, mozjpeg: true })
      .toBuffer();
  }

  const rotated = sharpMod(input).rotate();
  const meta = await rotated.metadata();
  let width = Number(meta.width || 0);
  let height = Number(meta.height || 0);
  if (width <= 0 || height <= 0) {
    return input;
  }

  let working = await applyWatermarkMask(sharpMod, input, width, height);
  const afterMask = await sharpMod(working).metadata();
  width = Number(afterMask.width || width);
  height = Number(afterMask.height || height);

  const extended = await extendWithMirroredWings(sharpMod, working, width, height);
  working = extended.buffer;
  width = extended.width;
  height = extended.height;

  let pipeline = sharpMod(working);

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
