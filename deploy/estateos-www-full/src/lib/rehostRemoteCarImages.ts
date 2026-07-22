import { saveCarListingImage } from "@/lib/upload/carMediaUpload";
import { isRemoteCarImageUrl } from "@/lib/otomotoCarImport";
import { upgradeListingImageUrl } from "@/lib/listingImageUrlUpgrade";

const MAX_REMOTE = 16;
const DOWNLOAD_TIMEOUT_MS = 18_000;
const CONCURRENCY = 3;
const MAX_BYTES = 12 * 1024 * 1024;

async function downloadRemoteImage(
  url: string,
): Promise<{ buffer: Buffer; mime: string; fileName: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  const fetchUrl = upgradeListingImageUrl(url);
  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: "https://www.otomoto.pl/",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      // Fallback to original URL if upgraded size is unavailable
      if (fetchUrl !== url) {
        const fallback = await fetch(url, {
          signal: controller.signal,
          headers: {
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://www.otomoto.pl/",
          },
          cache: "no-store",
        });
        if (!fallback.ok) return null;
        const mime = String(fallback.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        const buffer = Buffer.from(await fallback.arrayBuffer());
        if (!buffer.length || buffer.length > MAX_BYTES) return null;
        return { buffer, mime, fileName: "otomoto-import.jpg" };
      }
      return null;
    }
    const mime = String(response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    return { buffer, mime, fileName: "otomoto-import.jpg" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Re-host remote Otomoto CDN images. Never throws — keeps original URLs on failure
 * so listing create still succeeds.
 */
export async function rehostRemoteCarImages(params: {
  userId: number;
  imageUrls: string[];
}): Promise<string[]> {
  const source = params.imageUrls.map((u) => String(u || "").trim()).filter(Boolean).slice(0, MAX_REMOTE);
  if (!source.length) return [];

  const out: string[] = new Array(source.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < source.length) {
      const index = cursor;
      cursor += 1;
      const url = source[index];
      if (!isRemoteCarImageUrl(url)) {
        out[index] = url;
        continue;
      }
      try {
        const file = await downloadRemoteImage(url);
        if (!file) {
          out[index] = url;
          continue;
        }
        const saved = await saveCarListingImage({
          buffer: file.buffer,
          mimeTypeDeclared: file.mime,
          originalFileName: file.fileName,
          userId: params.userId,
        });
        out[index] = saved.ok ? saved.url : url;
      } catch {
        out[index] = url;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, source.length) }, () => worker()));
  return out.filter(Boolean);
}
