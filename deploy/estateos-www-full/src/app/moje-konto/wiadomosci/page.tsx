import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getAuthedUserIdFromRequest } from "@/lib/sessionAuth";
import ContactInboxClient from "@/components/contact/ContactInboxClient";
import ContactInboxLoading from "@/components/contact/ContactInboxLoading";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ContactInboxPage() {
  const userId = await getAuthedUserIdFromRequest();
  if (!userId) redirect("/login?redirect=/moje-konto/wiadomosci");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) redirect("/login?redirect=/moje-konto/wiadomosci");

  return (
    <Suspense fallback={<ContactInboxLoading />}>
      <ContactInboxClient currentUser={{ id: user.id, name: user.name }} />
    </Suspense>
  );
}
