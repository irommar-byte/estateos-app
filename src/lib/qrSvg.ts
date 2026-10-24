/**
 * Kod QR jako SVG (bez zewnętrznych usług). Generator: qrcode-generator (MIT, Kazuhiko Arase),
 * dołączony w src/lib/vendor/qrcode-generator.js.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const qrcode = require('./vendor/qrcode-generator.js') as (
  typeNumber: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H',
) => {
  addData: (data: string) => void;
  make: () => void;
  getModuleCount: () => number;
  isDark: (row: number, col: number) => boolean;
};

export function qrSvg(text: string, options: { size?: number; color?: string; background?: string } = {}): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const margin = 2;
  const total = count + margin * 2;
  const color = options.color || '#15171A';
  const background = options.background || '#FFFFFF';
  let path = '';
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) path += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  const size = options.size || 220;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="Kod QR"><rect width="${total}" height="${total}" fill="${background}"/><path d="${path}" fill="${color}"/></svg>`;
}
