import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveWebUserId } from "@/lib/webSessionAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function shapePreference(user: {
  intelligenceEnabled: boolean;
  intelligenceDecidedAt: Date | null;
}) {
  return {
    enabled: Boolean(user.intelligenceEnabled),
    decided: user.intelligenceDecidedAt != null,
    decidedAt: user.intelligenceDecidedAt?.toISOString() ?? null,
  };
}

/**
 * Account-scoped EstateOS™ Intelligence opt-in.
 * Cookie session (WWW) or Bearer JWT (mobile). Guests get 401 — clients keep local cache.
 */
export async function GET(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Zaloguj się, aby odczytać preferencję Intelligence." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { intelligenceEnabled: true, intelligenceDecidedAt: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "Użytkownik nie istnieje." }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, ...shapePreference(user) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[INTELLIGENCE PREFERENCE GET]", error);
    return NextResponse.json({ success: false, error: "Błąd serwera" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await resolveWebUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Zaloguj się, aby zapisać preferencję Intelligence." },
        { status: 401 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      enabled?: unknown;
      decided?: unknown;
    };

    const hasEnabled = typeof body.enabled === "boolean";
    const hasDecided = typeof body.decided === "boolean";

    if (!hasEnabled && !hasDecided) {
      return NextResponse.json(
        { success: false, error: "Podaj enabled i/lub decided (boolean)." },
        { status: 400 },
      );
    }

    const data: {
      intelligenceEnabled?: boolean;
      intelligenceDecidedAt?: Date | null;
    } = {};

    if (hasEnabled) {
      data.intelligenceEnabled = body.enabled as boolean;
      // Setting enabled always marks onboarding as decided (same as WWW decide()).
      data.intelligenceDecidedAt = new Date();
    } else if (hasDecided) {
      if (body.decided) {
        data.intelligenceDecidedAt = new Date();
      } else {
        data.intelligenceDecidedAt = null;
        data.intelligenceEnabled = false;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { intelligenceEnabled: true, intelligenceDecidedAt: true },
    });

    return NextResponse.json(
      { success: true, ...shapePreference(user) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[INTELLIGENCE PREFERENCE PATCH]", error);
    return NextResponse.json({ success: false, error: "Błąd serwera" }, { status: 500 });
  }
}
