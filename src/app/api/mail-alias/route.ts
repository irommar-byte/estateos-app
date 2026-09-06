import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/sessionUtils";
import { listAliasesForUser } from "@/lib/estateOsMailAlias";
import { getPublicationWallet } from "@/lib/publicationWallet";
import { purchaseMailAlias, serializeAlias } from "@/lib/purchaseMailAlias";

async function getSessionUserId(): Promise<number> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("estateos_session") || cookieStore.get("luxestate_user");
    const sessionData = sessionCookie ? decryptSession(sessionCookie.value) : null;
    return Number(sessionData?.id || 0);
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ success: false, loggedIn: false }, { status: 401 });
    }
    const [wallet, aliases] = await Promise.all([
      getPublicationWallet(userId, "pl"),
      listAliasesForUser(userId),
    ]);
    return NextResponse.json({
      success: true,
      loggedIn: true,
      plusCredits: wallet.plusCredits,
      hasPlusCredit: wallet.hasPlusCredit,
      aliases: aliases.map(serializeAlias),
    });
  } catch (error) {
    console.error("[mail-alias GET]", error);
    return NextResponse.json({ success: false, error: "LOAD_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ success: false, error: "AUTH", message: "Zaloguj się, aby kupić adres." }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const result = await purchaseMailAlias({
      userId,
      localPart: String(body?.alias || ""),
    });
    if (!result.ok) {
      const status =
        result.error === "NO_PLUS_CREDIT"
          ? 402
          : result.error === "NOT_CONFIGURED"
            ? 503
            : result.error === "TAKEN" || result.error === "RESERVED" || result.error === "INVALID"
              ? 409
              : 400;
      return NextResponse.json({ success: false, ...result }, { status });
    }
    const aliases = await listAliasesForUser(userId);
    return NextResponse.json({
      success: true,
      ...result,
      aliases: aliases.map(serializeAlias),
    });
  } catch (error) {
    console.error("[mail-alias POST]", error);
    return NextResponse.json(
      { success: false, error: "PURCHASE_FAILED", message: "Nie udało się dokończyć zakupu." },
      { status: 500 },
    );
  }
}
