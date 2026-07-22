import { prisma } from "@/lib/prisma";
import type { CarListingRecord } from "@/lib/carsStorage";

/** Numer do `tel:` — tylko cyfry i opcjonalny wiodący `+`. */
export function toTelHref(phone: string): string {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const plus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `tel:${plus}${digits}`;
}

/** Czytelny numer do UI (bez zmian formatu konta, tylko trim). */
export function formatDisplayPhone(phone: string): string {
  return String(phone || "").trim();
}

/**
 * Publiczny numer sprzedającego — tylko gdy oferta ma włączone `showContactPhone`
 * i użytkownik ma zapisany telefon na koncie.
 */
export async function resolveCarPublicContactPhone(
  car: Pick<CarListingRecord, "showContactPhone" | "userId">,
): Promise<string | null> {
  if (!car.showContactPhone || car.userId == null) return null;
  const userId = Number(car.userId);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const phone = formatDisplayPhone(user?.phone || "");
    return phone || null;
  } catch {
    return null;
  }
}
