import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const DOWNLOADS_DIR = path.join(process.cwd(), "public/downloads");

const FILE_META = {
  apk: {
    file: "estateos-android.apk",
    contentType: "application/vnd.android.package-archive",
    attachment: "estateos-android.apk",
  },
  aab: {
    file: "estateos-android.aab",
    contentType: "application/octet-stream",
    attachment: "estateos-android.aab",
  },
} as const;

/** preview-android v50 (989fd62e) — fallback gdy brak pliku na serwerze. */
const FALLBACK_APK_URL =
  "https://expo.dev/artifacts/eas/iDoRxQSDif0s8j27VBhEtwYXyCjJOEPg96eJ9a75iPk.apk";

async function serveLocalFile(kind: keyof typeof FILE_META) {
  const meta = FILE_META[kind];
  try {
    const filePath = path.join(DOWNLOADS_DIR, meta.file);
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": meta.contentType,
        "Content-Disposition": `attachment; filename="${meta.attachment}"`,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const wantsAab = request.nextUrl.pathname.endsWith(".aab");
  const kind = wantsAab ? "aab" : "apk";

  const local = await serveLocalFile(kind);
  if (local) return local;

  const redirectUrl =
    process.env.ANDROID_BETA_APK_REDIRECT_URL?.trim() ||
    process.env.NEXT_PUBLIC_ANDROID_BETA_APK_REDIRECT_URL?.trim();

  if (kind === "aab" && redirectUrl) {
    return NextResponse.redirect(redirectUrl, 302);
  }

  if (kind === "apk") {
    return NextResponse.redirect(FALLBACK_APK_URL, 302);
  }

  return NextResponse.json({ error: "Plik niedostępny." }, { status: 404 });
}
