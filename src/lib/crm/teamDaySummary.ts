import { prisma } from '@/lib/prisma';
import { callOpenAiText, getOpenAiApiKey, resolveOpenAiModel } from '@/lib/openAiClient';
import { DAY_SUMMARY_KIND, listTeamDay, logTeamEvent, warsawHour, warsawYmd, type TeamDayEvent } from '@/lib/crm/teamLog';

/**
 * Codzienny raport dla kierownika biura: o 20:00 (czas warszawski) każdy agent — kierownik też —
 * dostaje na swojej osi czasu w Dzienniku zespołu krótkie streszczenie całego dnia.
 * Uruchamiane co godzinę; działa tylko od 20:00 i tylko raz na agenta i dzień.
 */

const SUMMARY_HOUR = 20;
const MAX_LINES = 160;

function hm(iso: string): string {
  return new Date(iso).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
}

function clip(text: string | null, max: number): string {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Bez AI: ile akcji, w jakich godzinach i co dominowało. */
function plainSummary(events: TeamDayEvent[]): string {
  if (!events.length) return 'Brak zapisanych akcji tego dnia.';
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  const counts = new Map<string, number>();
  for (const e of sorted) counts.set(e.title, (counts.get(e.title) || 0) + 1);
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([title, n]) => (n > 1 ? `${title} (${n}×)` : title));
  return `${sorted.length} akcji od ${hm(sorted[0].at)} do ${hm(sorted[sorted.length - 1].at)}. Najważniejsze: ${top.join('; ')}.`;
}

async function aiSummary(name: string, role: string, events: TeamDayEvent[]): Promise<string> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey || !events.length) return plainSummary(events);
  const lines = [...events]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-MAX_LINES)
    .map((e) => `${hm(e.at)} — ${clip(e.title, 140)}${e.body ? ` — ${clip(e.body, 180)}` : ''}`)
    .join('\n');
  try {
    const { text } = await callOpenAiText({
      apiKey,
      model: resolveOpenAiModel(),
      system:
        'Jesteś asystentem kierownika biura nieruchomości. Na podstawie dziennika akcji z jednego dnia piszesz krótkie streszczenie pracy jednej osoby: ' +
        '3–5 zdań po polsku, rzeczowo, w trzeciej osobie, bez wstępów i bez list. Podaj, czym się zajmowała (klienci, oferty, prezentacje, negocjacje, wiadomości), ' +
        'co jest najważniejsze dla kierownika i co zostało w toku. Używaj tylko faktów z dziennika, nie zgaduj. Zdarzenia automatyczne (przypomnienia, dopasowania asystenta) wspomnij najwyżej jednym zdaniem.',
      user: `${role === 'ADMIN' ? 'Kierownik biura' : 'Agent'}: ${name}\nLiczba akcji: ${events.length}\n\nDziennik (godzina — akcja — szczegóły):\n${lines}`,
      maxOutputTokens: 420,
      temperature: 0.3,
      feature: 'team-day-summary',
      logPrefix: 'team-day-summary',
    });
    const clean = clip(text, 1800);
    return clean || plainSummary(events);
  } catch (error) {
    console.warn('[team-day-summary] AI niedostępne, streszczenie proste', error instanceof Error ? error.message : error);
    return plainSummary(events);
  }
}

export async function runTeamDaySummaries(options: { force?: boolean } = {}): Promise<{ skipped?: string; day: string; written: number }> {
  const now = new Date();
  const day = warsawYmd(now);
  if (!options.force && warsawHour(now) < SUMMARY_HOUR) return { skipped: 'przed 20:00', day, written: 0 };

  const companies = await prisma.agencyCompany.findMany({ select: { id: true } });
  let written = 0;
  for (const company of companies) {
    const data = await listTeamDay({ companyId: company.id, day: now });
    for (const agent of data.agents) {
      const mine = data.events.filter((e) => e.userId === agent.userId);
      if (mine.some((e) => e.kind === DAY_SUMMARY_KIND)) continue;
      const actions = mine.filter((e) => e.kind !== DAY_SUMMARY_KIND);
      const summary = await aiSummary(agent.name, agent.role, actions);
      await logTeamEvent({ userId: agent.userId, kind: DAY_SUMMARY_KIND, title: 'Podsumowanie dnia', body: summary });
      written += 1;
    }
  }
  return { day, written };
}
