import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 🔥 Łapie błąd, gdy body jest puste
    const body = await req.json().catch(() => ({}));

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "PL";

    console.log("[TRACK OK]", {
      ip: ip.split(',')[0].trim(),
      country: country.toUpperCase(),
      path: body?.path || "/"
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("[TRACK ERROR]", error);
    // Zawsze zwracamy 200, żeby nie psuć frontu
    return NextResponse.json({ success: true }); 
  }
}
