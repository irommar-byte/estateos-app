import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { decryptSession } from "@/lib/sessionUtils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export type OtodomImporterUser = {
  id: number;
  role: string;
  isPro: boolean;
};

export async function requireOtodomImporter(): Promise<OtodomImporterUser | null> {
  const nextAuth = await getServerSession(authOptions);
  const nextAuthEmail = String(nextAuth?.user?.email || "").trim().toLowerCase();
  if (nextAuthEmail) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthEmail },
      select: { id: true, role: true, isPro: true },
    });
    if (user && (user.role === "ADMIN" || user.isPro)) return user;
  }

  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get("estateos_session")?.value ||
    cookieStore.get("luxestate_user")?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || "").trim().toLowerCase();
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, isPro: true },
  });
  if (!user) return null;
  if (user.role === "ADMIN" || user.isPro) return user;
  return null;
}
