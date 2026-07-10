import { prisma } from "@/lib/prisma";
import { contactThreadPair } from "@/lib/contactThreadPair";
import { sendContactThreadMessage } from "@/lib/contactSendMessage";
import { findCarById } from "@/lib/carsStorage";
import { buildCarInquiryMessage } from "@/lib/carsPresentation";

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

async function isBlocked(a: number, b: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM MobileUserBlock
    WHERE (blockerUserId = ${a} AND blockedUserId = ${b})
       OR (blockerUserId = ${b} AND blockedUserId = ${a})
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function submitCarInquiry(params: {
  carId: number;
  buyerUserId: number;
  userMessage: string;
  viewingPreference: string;
  phone?: string;
  siteOrigin?: string;
}): Promise<
  | { ok: true; threadId: number; peerUserId: number }
  | { ok: false; status: number; error: string }
> {
  const car = await findCarById(params.carId);
  if (!car) return { ok: false, status: 404, error: "Ogłoszenie nie istnieje." };
  if (!car.userId) {
    return { ok: false, status: 400, error: "To ogłoszenie nie ma jeszcze przypisanego sprzedającego." };
  }
  if (car.userId === params.buyerUserId) {
    return { ok: false, status: 400, error: "Nie możesz wysłać zapytania do własnego ogłoszenia." };
  }

  const message = params.userMessage.trim();
  if (message.length < 8) {
    return { ok: false, status: 400, error: "Wiadomość musi mieć co najmniej 8 znaków." };
  }

  if (await isBlocked(params.buyerUserId, car.userId)) {
    return { ok: false, status: 403, error: "Kontakt z tym użytkownikiem jest zablokowany." };
  }

  const peer = await prisma.user.findUnique({ where: { id: car.userId }, select: USER_SELECT });
  if (!peer) return { ok: false, status: 404, error: "Sprzedający nie istnieje." };

  const pair = contactThreadPair(params.buyerUserId, car.userId);
  const thread = await prisma.contactThread.upsert({
    where: { userLowId_userHighId: pair },
    update: {},
    create: pair,
    select: { id: true },
  });

  const origin = (params.siteOrigin || "https://estateos.pl").replace(/\/+$/, "");
  const content = buildCarInquiryMessage({
    carTitle: car.title,
    make: car.make,
    model: car.model,
    year: car.year,
    pricePln: car.pricePln,
    city: car.city,
    viewingPreference: params.viewingPreference,
    userMessage: message,
    phone: params.phone,
    carUrl: `${origin}/cars/${car.id}`,
  });

  const sent = await sendContactThreadMessage({
    threadId: thread.id,
    userId: params.buyerUserId,
    content,
  });

  if (!sent.ok) {
    return { ok: false, status: sent.status, error: sent.error };
  }

  return { ok: true, threadId: thread.id, peerUserId: car.userId };
}
