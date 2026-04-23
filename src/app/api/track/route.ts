import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const country = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "PL";

    await prisma.siteVisit.create({
      data: {
        ip: ip.split(',')[0].trim(),
        country: country.toUpperCase(),
        path: body.path || "/"
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Tracking error" }, { status: 500 });
  }
}
