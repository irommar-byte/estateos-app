import { saveCarListingImage } from "@/lib/upload/carMediaUpload";
import { isRemoteCarImageUrl } from "@/lib/otomotoCarImport";

const MAX_REMOTE = 24;
const DOWNLOAD_TIMEOUT_MS = 25_000;

async function downloadRemoteImage(url: string): Promise<{ buffer: Buffer; mime: string; fileName: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.otomoto.pl/",
      },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const mime = String(response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) return null;
    return { buffer, mime, fileName: "otomoto-import.jpg" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Re-host remote Otomoto CDN images into EstateOS car uploads during publish. */
export async function rehostRemoteCarImages(params: {
  userId: number;
  imageUrls: string[];
}): Promise<string[]> {
  const out: string[] = [];
  for (const raw of params.imageUrls.slice(0, MAX_REMOTE)) {
    const url = String(raw || "").trim();
    if (!url) continue;
    if (!isRemoteCarImageUrl(url)) {
      out.push(url);
      continue;
    }
    const file = await downloadRemoteImage(url);
    if (!file) continue;
    const saved = await saveCarListingImage({
      buffer: file.buffer,
      mimeTypeDeclared: file.mime,
      originalFileName: file.fileName,
      userId: params.userId,
    });
    if (saved.ok) out.push(saved.url);
  }
  return out;
}
