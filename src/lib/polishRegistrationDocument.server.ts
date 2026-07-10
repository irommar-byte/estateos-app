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

export async function decodeAztecFromImageBuffer(buffer: Buffer): Promise<string> {
  const sharp = (await import("sharp")).default;
  const {
    MultiFormatReader,
    BarcodeFormat,
    DecodeHintType,
    BinaryBitmap,
    HybridBinarizer,
    RGBLuminanceSource,
  } = await import("@zxing/library");

  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.AZTEC]);
  hints.set(DecodeHintType.TRY_HARDER, true);

  const reader = new MultiFormatReader();
  reader.setHints(hints);

  const attempts = [
    sharp(buffer).rotate().grayscale().raw(),
    sharp(buffer).rotate().resize({ width: 2200, withoutEnlargement: false }).grayscale().raw(),
    sharp(buffer).rotate().resize({ width: 1400, withoutEnlargement: false }).normalize().grayscale().raw(),
  ];

  let lastError: Error | null = null;
  for (const pipeline of attempts) {
    try {
      const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
      const source = new RGBLuminanceSource(new Uint8ClampedArray(data), info.width, info.height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(source));
      return reader.decode(bitmap).getText();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Nie udało się odczytać kodu Aztec ze zdjęcia.");
    }
  }

  throw lastError || new Error("Nie udało się odczytać kodu Aztec ze zdjęcia.");
}

export function decodeRegistrationDocument(aztecPayload: string) {
  const parsed = decodeAztecPayload(aztecPayload);
  return {
    parsed,
    prefill: mapToCarFormPrefill(parsed),
  };
}
