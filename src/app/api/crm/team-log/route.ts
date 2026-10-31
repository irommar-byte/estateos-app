import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { prisma } from '@/lib/prisma';
import { DAY_SUMMARY_KIND, listTeamDay } from '@/lib/crm/teamLog';

/**
 * Dziennik zespołu. Kierownik biura widzi wszystkich agentów, agent — tylko siebie.
 * GET ?day=YYYY-MM-DD (domyślnie dziś, czas warszawski). Podsumowania dnia (20:00) widzi tylko kierownik.
 */
export async function GET(req: Request) {
  const userId = await requireAgencyUserId(req);
  if (!userId) return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });

  const url = new URL(req.url);
  const raw = url.searchParams.get('day') || '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00Z`) : new Date();

  const member = await prisma.agencyCompanyMember.findUnique({ where: { userId }, select: { companyId: true, role: true } });
  const owned = await prisma.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } });
  const companyId = member?.companyId ?? owned?.id ?? null;
  const isManager = Boolean(owned) || member?.role === 'ADMIN' || String(member?.role) === 'MANAGER';
  if (!companyId) return NextResponse.json({ success: true, isManager: false, agents: [], events: [] });

  const data = await listTeamDay({ companyId, day });
  if (isManager) return NextResponse.json({ success: true, isManager: true, ...data });
  return NextResponse.json({
    success: true,
    isManager: false,
    agents: data.agents.filter((a) => a.userId === userId),
    events: data.events.filter((e) => e.userId === userId && e.kind !== DAY_SUMMARY_KIND),
  });
}
