import { NextResponse } from "next/server";
import { buildMarketPulse } from "@/lib/marketPulseLive";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_SECONDS = 45;

function parseLocale(value: string | null): Locale {
  return value === "en" ? "en" : "pl";
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const locale = parseLocale(searchParams.get("locale"));

    const payload = await buildMarketPulse(locale);

    return NextResponse.json(
      { success: true, ...payload },
      {
        headers: {
          "Cache-Control": `private, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[pro-widget/pulse]", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
