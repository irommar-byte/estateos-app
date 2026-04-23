import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    const decoded: any = payload;

    const user = await prisma.user.findUnique({
      where: { id: Number(decoded.id) }
    });

    if (!user) {
      return NextResponse.json({ success: false }, { status: 404 });
    }

    // fallback jeśli nie masz firstName/lastName w DB
    const nameParts = (user.name || "").split(" ");
    const firstName = user.firstName || nameParts[0] || "";
    const lastName = user.lastName || nameParts.slice(1).join(" ");

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName,
        lastName,
        phone: user.phone,
        avatar: user.image,
        role: user.role
      }
    });

  } catch (e) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
}
