import {
  formatClientFeedbackForAgent,
  parseClientOfferFeedback,
} from '@/lib/crm/clientPortalFeedback';

export type BuyerAgentTask = {
  id: string;
  activityId: number;
  kind: 'viewing' | 'question' | 'handoff' | 'stalled';
  priority: 'high' | 'normal';
  title: string;
  body: string;
  createdAt: string;
  matchId: number | null;
  offerId: number | null;
};

type TaskMatch = {
  id: number;
  clientFeedback: string | null;
  clientFeedbackAt: Date | string | null;
  offer: { id: number; title: string };
};

type TaskActivity = {
  id: number;
  kind: string;
  title: string | null;
  body: string | null;
  offerId?: number | null;
  createdAt: Date | string;
  metadata?: unknown;
};

function record(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function iso(raw: Date | string): string {
  const value = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
}

function isHandled(activity: TaskActivity): boolean {
  const metadata = record(activity.metadata);
  return metadata.agentStatus === 'done' || Boolean(metadata.agentHandledAt);
}

export function buildBuyerAgentTasks(
  matches: TaskMatch[],
  activities: TaskActivity[],
): BuyerAgentTask[] {
  const handoffKeys = new Set<string>();
  const openHandoffs = activities
    .filter(
      (activity) =>
        (activity.kind === 'INTELLIGENCE_HANDOFF' || activity.kind === 'INTELLIGENCE_STALLED') &&
        !isHandled(activity),
    )
    .sort((a, b) => iso(b.createdAt).localeCompare(iso(a.createdAt)) || b.id - a.id)
    .filter((activity) => {
      const metadata = record(activity.metadata);
      const key = [
        activity.kind,
        Number(metadata.matchId) || '',
        activity.offerId || '',
        activity.body || '',
      ].join('|');
      if (handoffKeys.has(key)) return false;
      handoffKeys.add(key);
      return true;
    });
  const handoffMatchIds = new Set(
    openHandoffs
      .map((activity) => Number(record(activity.metadata).matchId))
      .filter((id) => Number.isFinite(id) && id > 0),
  );

  const feedbackActivityByMatch = new Map<number, TaskActivity>();
  for (const activity of activities) {
    if (activity.kind !== 'CLIENT_FEEDBACK') continue;
    const matchId = Number(record(activity.metadata).matchId);
    if (!Number.isFinite(matchId) || matchId <= 0 || feedbackActivityByMatch.has(matchId)) continue;
    feedbackActivityByMatch.set(matchId, activity);
  }

  const tasks: BuyerAgentTask[] = [];
  for (const match of matches) {
    const feedback = parseClientOfferFeedback(match.clientFeedback);
    const needsAgent =
      feedback.sentiment === 'like' ||
      (feedback.sentiment === 'maybe' && Boolean(feedback.note || feedback.liked || feedback.disliked));
    if (!needsAgent || !match.clientFeedbackAt || handoffMatchIds.has(match.id)) continue;

    const activity = feedbackActivityByMatch.get(match.id);
    if (!activity || isHandled(activity)) continue;
    const viewing = feedback.sentiment === 'like';
    tasks.push({
      id: `activity-${activity.id}`,
      activityId: activity.id,
      kind: viewing ? 'viewing' : 'question',
      priority: 'high',
      title: viewing
        ? `Klient chce obejrzeć: ${match.offer.title}`
        : `Klient czeka na odpowiedź: ${match.offer.title}`,
      body: formatClientFeedbackForAgent(match.clientFeedback),
      createdAt: iso(match.clientFeedbackAt),
      matchId: match.id,
      offerId: match.offer.id,
    });
  }

  for (const activity of openHandoffs) {
    const metadata = record(activity.metadata);
    const matchId = Number(metadata.matchId);
    tasks.push({
      id: `activity-${activity.id}`,
      activityId: activity.id,
      kind: activity.kind === 'INTELLIGENCE_STALLED' ? 'stalled' : 'handoff',
      priority: 'high',
      title:
        activity.title ||
        (activity.kind === 'INTELLIGENCE_STALLED'
          ? 'Asystent potrzebuje decyzji agenta'
          : 'Klient czeka na agenta'),
      body: activity.body || 'Otwórz kartę klienta i wybierz kolejny krok.',
      createdAt: iso(activity.createdAt),
      matchId: Number.isFinite(matchId) && matchId > 0 ? matchId : null,
      offerId: activity.offerId || null,
    });
  }

  return tasks
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.activityId - a.activityId)
    .slice(0, 8);
}
