import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import {
  AGENCY_UPLOAD_BASE_FS,
  AGENCY_UPLOAD_PUBLIC_PREFIX,
} from "@/lib/upload/agencyBrandingUpload";
import { isValidImageMagic } from "@/lib/upload/offerMediaUpload";

export const MAX_ACQUISITION_DOCUMENT_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function sniffMime(buffer: Buffer, declared: string, fileName: string): string | null {
  const lower = fileName.toLowerCase();
  const declaredTrim = String(declared || "").trim();
  if (declaredTrim === "application/pdf" || lower.endsWith(".pdf") || buffer.slice(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (declaredTrim.startsWith("image/") && ALLOWED_MIME.has(declaredTrim) && isValidImageMagic(buffer, declaredTrim)) {
    return declaredTrim;
  }
  if (isValidImageMagic(buffer, "image/jpeg") || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (isValidImageMagic(buffer, "image/png") || lower.endsWith(".png")) return "image/png";
  if (isValidImageMagic(buffer, "image/webp") || lower.endsWith(".webp")) return "image/webp";
  return null;
}

export async function saveAcquisitionPaperFile(params: {
  clientId: number;
  buffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
}): Promise<
  | { ok: true; url: string; name: string; mimeType: string; size: number }
  | { ok: false; status: number; error: string }
> {
  if (!Number.isFinite(params.clientId) || params.clientId <= 0) {
    return { ok: false, status: 400, error: "Brak klienta." };
  }
  if (!params.buffer.length) {
    return { ok: false, status: 400, error: "Pusty plik." };
  }
  if (params.buffer.length > MAX_ACQUISITION_DOCUMENT_BYTES) {
    return { ok: false, status: 413, error: "Plik jest za duży (max 15 MB)." };
  }

  const originalName = String(params.originalFileName || "umowa").trim() || "umowa";
  const mime = sniffMime(params.buffer, params.mimeTypeDeclared, originalName);
  if (!mime) {
    return { ok: false, status: 415, error: "Dozwolone: PDF, JPG, PNG lub WEBP." };
  }

  const dir = AGENCY_UPLOAD_BASE_FS;
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    return { ok: false, status: 500, error: "Nie udało się przygotować katalogu." };
  }

  const ext = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg";
  const fileName = `acq-${params.clientId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.writeFile(path.join(dir, fileName), params.buffer);

  return {
    ok: true,
    url: `${AGENCY_UPLOAD_PUBLIC_PREFIX}/${fileName}`,
    name: originalName.slice(0, 120),
    mimeType: mime,
    size: params.buffer.length,
  };
}
