import nrv2eDecompress from "nrv2e-decompress";
import { readBarcodes } from "zxing-wasm/reader";
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

async function buildImageAttempts(buffer: Buffer) {
  const sharp = (await import("sharp")).default;
  const base = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await base.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error("Nie udało się odczytać wymiarów zdjęcia.");

  const toJpeg = (pipeline: SharpPipeline) => pipeline.jpeg({ quality: 95, mozjpeg: true });

  const attempts: SharpPipeline[] = [
    toJpeg(base.clone().resize({ width: 1800, withoutEnlargement: false })),
    toJpeg(base.clone().resize({ width: 2200, withoutEnlargement: false })),
    toJpeg(base.clone().resize({ width: 1400, withoutEnlargement: false })),
    toJpeg(base.clone().resize({ width: 1200, withoutEnlargement: false })),
    toJpeg(base.clone().resize({ width: 1800, withoutEnlargement: false }).normalize().sharpen()),
    toJpeg(base.clone().resize({ width: 1800, withoutEnlargement: false }).grayscale().normalize().sharpen()),
    toJpeg(base.clone()),
  ];

  const crops = [
    { left: 0, top: Math.floor(height * 0.35), width, height: Math.ceil(height * 0.65) },
    { left: Math.floor(width * 0.2), top: Math.floor(height * 0.35), width: Math.ceil(width * 0.8), height: Math.ceil(height * 0.65) },
    { left: 0, top: 0, width, height },
  ];

  for (const region of crops) {
    if (region.width < 120 || region.height < 120) continue;
    attempts.push(
      toJpeg(base.clone().extract(region).resize({ width: 1800, withoutEnlargement: false })),
      toJpeg(base.clone().extract(region).resize({ width: 2200, withoutEnlargement: false }).normalize().sharpen()),
    );
  }

  for (const angle of [90, 180, 270]) {
    attempts.push(toJpeg(base.clone().rotate(angle).resize({ width: 1800, withoutEnlargement: false })));
  }

  return attempts;
}

async function decodeAztecFromEncodedImage(imageBuffer: Buffer) {
  const results = await readBarcodes(new Uint8Array(imageBuffer), {
    tryHarder: true,
    formats: ["Aztec"],
    maxNumberOfSymbols: 3,
  });

  const hit = results.find((item) => item.text?.trim());
  if (!hit?.text) throw new Error("Brak kodu Aztec w tej próbce obrazu.");
  return hit.text.trim();
}

export async function decodeAztecFromImageBuffer(buffer: Buffer): Promise<string> {
  const attempts = await buildImageAttempts(buffer);
  let lastError: Error | null = null;

  for (const pipeline of attempts) {
    try {
      const imageBuffer = await pipeline.toBuffer();
      return await decodeAztecFromEncodedImage(imageBuffer);
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
