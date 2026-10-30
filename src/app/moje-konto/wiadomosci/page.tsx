import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";
import ContactInboxClient from "@/components/contact/ContactInboxClient";
import { prisma } from "@/lib/prisma";
import { isAgentOrAgencySeller } from "@/lib/sellerDisplay";

export const dynamic = "force-dynamic";

export default async function ContactInboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await getAuthedUserIdFromRequest();
  if (!userId) redirect("/login?redirect=/moje-konto/wiadomosci");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, planType: true },
  });
  if (!user) redirect("/login?redirect=/moje-konto/wiadomosci");

  // Agent ma wiadomości w swoim CRM — ta sama skrzynka, w premium ramie.
  if (isAgentOrAgencySeller(user)) {
    const sp = await searchParams;
    const q = new URLSearchParams({ tab: "wiadomosci" });
    for (const key of ["thread", "peer", "from"]) {
      const v = sp[key];
      if (typeof v === "string" && v) q.set(key, v);
    }
    redirect(`/moje-konto/crm?${q.toString()}`);
  }

  return (
    <Suspense fallback={<div className="p-10 text-center text-[var(--eos-muted)]">Ładowanie wiadomości…</div>}>
      <ContactInboxClient currentUser={{ id: user.id, name: user.name }} />
    </Suspense>
  );
}
