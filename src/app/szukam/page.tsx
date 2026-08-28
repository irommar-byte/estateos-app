import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import BuyerIntakeFlowClient from '@/components/buyer-intake/BuyerIntakeFlowClient';
import {
  BUYER_MISSION_COOKIE,
  decodeBuyerMissionCookie,
  resolveBuyerIntakeAgent,
} from '@/lib/buyerIntake.server';
import { isBuyerStep4Complete } from '@/lib/buyerIntakeShared';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Szukam nieruchomości z agentem',
  description:
    'Powiedz, czego szukasz — bezpłatnie dla kupujących. Agent EstateOS™ poprowadzi wyszukiwanie w pakiecie, umówi oglądania i dopilnuje finalizacji — bez kontaktu ze sprzedającymi.',
  robots: { index: false, follow: false },
};

export default async function SzukamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.agent != null || sp.ref != null || sp.invite != null) {
    redirect('/szukam');
  }

  const agent = await resolveBuyerIntakeAgent();
  const cookieStore = await cookies();
  const mission = decodeBuyerMissionCookie(cookieStore.get(BUYER_MISSION_COOKIE)?.value);

  if (!agent) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--eos-bg)] px-6">
        <div className="max-w-md rounded-[1.75rem] border border-[var(--eos-border)] bg-[var(--eos-card)] p-8 text-center shadow-lg">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-[var(--eos-subtle)]">EstateOS™ Buyer</p>
          <h1 className="mt-3 text-xl font-semibold text-[var(--eos-text)]">Kanał chwilowo niedostępny</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--eos-muted)]">
            Skonfiguruj agenta odbioru (`BUYER_INTAKE_AGENT_USER_ID` lub `BUYER_INTAKE_AGENT_EMAIL`) i odśwież stronę.
          </p>
        </div>
      </main>
    );
  }

  if (mission && mission.agentUserId !== agent.userId) {
    // Stara sesja innego agenta — ignorujemy w UI (cookie zostanie nadpisane w kroku 1).
  }

  const initialMission =
    mission && mission.agentUserId === agent.userId
      ? mission
      : null;

  if (initialMission && isBuyerStep4Complete(initialMission) && initialMission.clientId) {
    const client = await prisma.agencyClient.findUnique({
      where: { id: initialMission.clientId },
      select: { portalToken: true, agencyUserId: true },
    });
    if (client?.portalToken && client.agencyUserId === agent.userId) {
      redirect(`/klient/${encodeURIComponent(client.portalToken)}?from=szukam`);
    }
  }

  return (
    <BuyerIntakeFlowClient
      agent={{
        displayName: agent.displayName,
        companyName: agent.companyName,
        agentTitle: agent.agentTitle,
        image: agent.image,
      }}
      initialMission={initialMission}
    />
  );
}
