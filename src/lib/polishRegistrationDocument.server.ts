import nrv2eDecompress from "nrv2e-decompress";
import {
  mapToCarFormPrefill,
  parseRegistrationFields,
  type ParsedRegistrationDocument,
} from "@/lib/polishRegistrationDocument.shared";

export {
  mapBodyTypeFromKind,
  mapToCarFormPrefill,
  parseRegistrationFields,
  listMissingListingFields,
  type CarListingMissingFieldKey,
  type CarRegistrationPrefill,
  type ParsedRegistrationDocument,
} from "@/lib/polishRegistrationDocument.shared";

export function decodeAztecPayload(base64Input: string): ParsedRegistrationDocument {
  const cleaned = base64Input.trim().replace(/\s+/g, "");
  if (!cleaned) throw new Error("Pusty kod Aztec z dowodu rejestracyjnego.");

  const binInput = Buffer.from(cleaned, "base64");
  if (binInput.length < 8) throw new Error("Nieprawidłowy kod Aztec z dowodu rejestracyjnego.");

  const outputLength = binInput.readUInt32LE(0);
  if (outputLength <= 0 || outputLength > 100_000) {
    throw new Error("Nieprawidłowy kod Aztec z dowodu rejestracyjnego.");
  }

  const utf16Output = Buffer.alloc(outputLength);
  nrv2eDecompress(binInput.subarray(4), utf16Output);

  const textOutput = utf16Output.toString("utf16le");
  const fields = textOutput.split("|");
  if (fields.length < 20) {
    throw new Error("Odczytany kod nie wygląda na polski dowód rejestracyjny.");
  }

  return parseRegistrationFields(fields);
}

type SharpPipeline = import("sharp").Sharp;

type LuminanceFrame = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

async function toLuminance(pipeline: SharpPipeline): Promise<LuminanceFrame> {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const len = info.width * info.height;
  const luminances = new Uint8ClampedArray(len);
  const channels = info.channels;

  if (channels === 1) {
    for (let i = 0; i < len; i += 1) luminances[i] = data[i] ?? 0;
  } else {
    for (let i = 0; i < len; i += 1) {
      const offset = i * channels;
      luminances[i] = Math.round(((data[offset] ?? 0) + (data[offset + 1] ?? 0) * 2 + (data[offset + 2] ?? 0)) / 4);
    }
  }

  return { data: luminances, width: info.width, height: info.height };
}

function cropRegion(
  base: SharpPipeline,
  region: { left: number; top: number; width: number; height: number },
) {
  return base.clone().extract(region);
}

async function buildImageAttempts(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("Nie udało się odczytać wymiarów zdjęcia.");

  const attempts: SharpPipeline[] = [
    base.clone(),
    base.clone().resize({ width: 1800, withoutEnlargement: false }),
    base.clone().resize({ width: 1400, withoutEnlargement: false }),
    base.clone().resize({ width: 1100, withoutEnlargement: false }),
    base.clone().resize({ width: 900, withoutEnlargement: false }),
    base.clone().normalize(),
    base.clone().resize({ width: 1600, withoutEnlargement: false }).normalize().sharpen(),
    base.clone().resize({ width: 1400, withoutEnlargement: false }).linear(1.2, -20),
    base.clone().resize({ width: 1400, withoutEnlargement: false }).grayscale().normalize().sharpen(),
  ];

  const crops = [
    { left: 0, top: Math.floor(height * 0.45), width, height: Math.ceil(height * 0.55) },
    { left: Math.floor(width * 0.35), top: Math.floor(height * 0.45), width: Math.ceil(width * 0.65), height: Math.ceil(height * 0.55) },
    { left: Math.floor(width * 0.15), top: Math.floor(height * 0.2), width: Math.ceil(width * 0.7), height: Math.ceil(height * 0.7) },
  ];

  for (const region of crops) {
    if (region.width < 120 || region.height < 120) continue;
    attempts.push(
      cropRegion(base, region),
      cropRegion(base, region).resize({ width: 1400, withoutEnlargement: false }),
      cropRegion(base, region).resize({ width: 1400, withoutEnlargement: false }).normalize().sharpen(),
    );
  }

  for (const angle of [90, 180, 270]) {
    attempts.push(base.clone().rotate(angle).resize({ width: 1400, withoutEnlargement: false }));
  }

  return attempts;
}

async function decodeLuminanceFrame(frame: LuminanceFrame) {
  const {
    MultiFormatReader,
    BarcodeFormat,
    DecodeHintType,
    BinaryBitmap,
    HybridBinarizer,
    GlobalHistogramBinarizer,
    RGBLuminanceSource,
  } = await import("@zxing/library");

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  const source = new RGBLuminanceSource(frame.data, frame.width, frame.height);
  const binarizers = [HybridBinarizer, GlobalHistogramBinarizer];

  for (const Binarizer of binarizers) {
    try {
      return reader.decode(new BinaryBitmap(new Binarizer(source))).getText();
    } catch {
      // try next binarizer
    }
  }

  throw new Error("Brak kodu Aztec w tej próbce obrazu.");
}

export async function decodeAztecFromImageBuffer(buffer: Buffer): Promise<string> {
  const attempts = await buildImageAttempts(buffer);
  let lastError: Error | null = null;

  for (const pipeline of attempts) {
    try {
      const frame = await toLuminance(pipeline);
      if (frame.width < 80 || frame.height < 80) continue;
      return await decodeLuminanceFrame(frame);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Nie udało się odczytać kodu Aztec ze zdjęcia.");
    }
  }

  throw new Error(
    lastError?.message?.includes("Aztec")
      ? "Nie znaleziono kodu Aztec na zdjęciu. Zrób zdjęcie tyłu dowodu z dobrze widocznym kwadratowym kodem, bez rozmycia i odblasków."
      : lastError?.message || "Nie udało się odczytać kodu Aztec ze zdjęcia.",
  );
}

export function decodeRegistrationDocument(aztecPayload: string) {
  const parsed = decodeAztecPayload(aztecPayload);
  return {
    parsed,
    prefill: mapToCarFormPrefill(parsed),
  };
}
