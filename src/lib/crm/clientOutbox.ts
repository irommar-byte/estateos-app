import { AsyncLocalStorage } from 'node:async_hooks';
import { prisma } from '@/lib/prisma';
import { sendTransactionalEmail, type EmailParams } from '@/lib/email/transactional';
import { sendSmsChecked } from '@/lib/sms';
import { sendPortalChat } from '@/lib/crm/portalChat';
import { sendClientPortalWebPush } from '@/lib/crm/clientPortalWebPush';
import { sendNotification } from '@/lib/core/notification.core';
import { crmAgentPushData } from '@/lib/crm/agentPush';

/**
 * Bramka wszystkiego, co wychodzi do klienta w imieniu agenta.
 *
 * Zasada: nic nie wychodzi bez weryfikacji agenta. Wiadomość:
 *  - idzie od razu, gdy agent ją właśnie zobaczył i zatwierdził (approved: true),
 *    albo gdy dla tego klienta włączył „od teraz automatycznie” dla tego rodzaju wiadomości;
 *  - w przeciwnym razie czeka w kolejce „Do wysłania” (ekran „Dziś”) z pełnym podglądem.
 */

export const OUTBOX_CATEGORIES = {
  offer: 'Propozycje ofert',
  assistant: 'Wiadomości asystenta w czacie',
  reminder: 'Przypomnienia o ocenie ofert',
  schedule: 'Terminy spotkań i pokazów',
  visit: 'Materiały do pokazu i potwierdzenia',
  marketing: 'Raporty z promocji oferty',
  documents: 'Dokumenty i umowy',
  card: 'Wizytówka i powitanie',
  decision: 'Prośby o decyzję',
  alert: 'Alerty o ulubionych ofertach',
  digest: 'Podsumowanie tygodnia',
} as const;

export type OutboxCategory = keyof typeof OUTBOX_CATEGORIES;

type SerializedAttachment = { filename: string; contentType?: string; base64: string };

export type OutboxStep =
  | {
      kind: 'email';
      to: string;
      subject: string;
      html: string;
      from?: string;
      replyTo?: string;
      attachments?: SerializedAttachment[];
    }
  | { kind: 'sms'; to: string; message: string }
  | { kind: 'chat'; params: Parameters<typeof sendPortalChat>[0] }
  | { kind: 'push'; clientId: number; payload: Parameters<typeof sendClientPortalWebPush>[1] }
  /** Powiadomienie w aplikacji EstateOS na koncie klienta (gdy ma konto). */
  | { kind: 'notify'; userId: number; title: string; body: string; data?: Record<string, unknown> }
  /**
   * Odroczona akcja wykonywana dopiero po akceptacji (np. udostępnienie oferty —
   * dzięki temu klient nie widzi jej w panelu, zanim agent zatwierdzi).
   */
  | { kind: 'action'; name: 'notifyOffer' | 'notifyOffers'; params: Record<string, unknown> };

export type DeliverResult =
  | { sent: true; queued: false; outboxId: null; emailSent: boolean; smsSent: boolean; chatSent: boolean }
  | { sent: false; queued: true; outboxId: number; emailSent: false; smsSent: false; chatSent: false };

export type QueuedOutboxSummary = {
  id: number;
  clientId: number;
  category: OutboxCategory;
  categoryLabel: string;
  channels: string[];
  recipient: string | null;
  subject: string | null;
};

/* ───────────── zbieranie kolejki w ramach jednego żądania API ───────────── */

const requestCollector = new AsyncLocalStorage<QueuedOutboxSummary[]>();

/** Uruchamia handler i zwraca listę wiadomości, które w trakcie trafiły do kolejki. */
export async function collectQueuedOutbox<T>(fn: () => Promise<T>): Promise<{ value: T; queued: QueuedOutboxSummary[] }> {
  const queued: QueuedOutboxSummary[] = [];
  const value = await requestCollector.run(queued, fn);
  return { value, queued };
}

/** Dokleja do odpowiedzi JSON pole `outbox` — aplikacja od razu pokaże podgląd do akceptacji. */
export async function withOutboxResponse(fn: () => Promise<Response>): Promise<Response> {
  const { value: response, queued } = await collectQueuedOutbox(fn);
  if (!queued.length) return response;
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response;
  try {
    const json = await response.clone().json();
    if (!json || typeof json !== 'object' || Array.isArray(json)) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify({ ...json, outbox: queued }), { status: response.status, headers });
  } catch {
    return response;
  }
}

/* ───────────── pomocnicze ───────────── */

function serializeAttachments(attachments: EmailParams['attachments']): SerializedAttachment[] | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((item) => ({
    filename: item.filename,
    contentType: item.contentType,
    base64: Buffer.isBuffer(item.content) ? item.content.toString('base64') : Buffer.from(String(item.content)).toString('base64'),
  }));
}

/** Krok e-mail z parametrów sendTransactionalEmail (załączniki zapisane jako base64). */
export function emailStep(params: EmailParams): OutboxStep {
  return {
    kind: 'email',
    to: params.to,
    subject: params.subject,
    html: params.html,
    from: params.from,
    replyTo: params.replyTo,
    attachments: serializeAttachments(params.attachments),
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function parseAutoSendCategories(raw: unknown): OutboxCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is OutboxCategory => typeof value === 'string' && value in OUTBOX_CATEGORIES);
}

export async function isClientAutoSendAllowed(clientId: number, category: OutboxCategory): Promise<boolean> {
  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: { autoSendCategories: true, intelligenceMode: true },
  });
  if (!client) return false;
  if (category === 'offer' && client.intelligenceMode === 'AUTOPILOT') return true;
  return parseAutoSendCategories(client.autoSendCategories).includes(category);
}

function describeSteps(steps: OutboxStep[]) {
  const email = steps.find((step): step is Extract<OutboxStep, { kind: 'email' }> => step.kind === 'email');
  const sms = steps.find((step): step is Extract<OutboxStep, { kind: 'sms' }> => step.kind === 'sms');
  const chat = steps.find((step): step is Extract<OutboxStep, { kind: 'chat' }> => step.kind === 'chat');
  const channels = [
    email ? 'email' : null,
    sms ? 'sms' : null,
    chat ? 'chat' : null,
    steps.some((step) => step.kind === 'push' || step.kind === 'notify') ? 'push' : null,
  ].filter(Boolean) as string[];
  const pushStep = steps.find((step): step is Extract<OutboxStep, { kind: 'push' }> => step.kind === 'push');
  const previewParts = [
    chat?.params.content ? String(chat.params.content) : null,
    !chat && !sms && !email && pushStep ? `${pushStep.payload.title}\n${pushStep.payload.body}` : null,
    sms ? `SMS: ${sms.message}` : null,
    email ? htmlToText(email.html) : null,
  ].filter(Boolean) as string[];
  return {
    channels,
    recipient: email?.to || sms?.to || null,
    subject: email?.subject || (chat ? 'Wiadomość w panelu klienta' : sms ? 'SMS' : null),
    previewText: previewParts.join('\n\n').slice(0, 20000) || null,
    previewHtml: email?.html || null,
  };
}

/* ───────────── wysyłka ───────────── */

async function executeSteps(steps: OutboxStep[]): Promise<{ emailSent: boolean; smsSent: boolean; chatSent: boolean; errors: string[] }> {
  let emailSent = false;
  let smsSent = false;
  let chatSent = false;
  const errors: string[] = [];
  for (const step of steps) {
    try {
      if (step.kind === 'email') {
        const ok = await sendTransactionalEmail({
          to: step.to,
          subject: step.subject,
          html: step.html,
          from: step.from,
          replyTo: step.replyTo,
          attachments: step.attachments?.map((item) => ({
            filename: item.filename,
            contentType: item.contentType,
            content: Buffer.from(item.base64, 'base64'),
          })),
        });
        if (ok) emailSent = true;
        else errors.push('Nie udało się wysłać e-maila.');
      } else if (step.kind === 'sms') {
        const result = await sendSmsChecked(step.to, step.message);
        if (result.ok) smsSent = true;
        else errors.push(`SMS: ${result.error || 'błąd wysyłki'}`);
      } else if (step.kind === 'chat') {
        const result = await sendPortalChat(step.params);
        if (result.ok) chatSent = true;
        else errors.push(result.error || 'Nie udało się dodać wiadomości w panelu.');
      } else if (step.kind === 'push') {
        await sendClientPortalWebPush(step.clientId, step.payload).catch(() => {});
      } else if (step.kind === 'action') {
        const notify = await import('@/lib/agencyClientNotify');
        if (step.name === 'notifyOffer') {
          const result = await notify.notifyAgencyClientAboutOffer({
            ...(step.params as Parameters<typeof notify.notifyAgencyClientAboutOffer>[0]),
            approved: true,
          });
          if (result.emailSent) emailSent = true;
          chatSent = true;
        } else if (step.name === 'notifyOffers') {
          const result = await notify.notifyAgencyClientAboutOffers({
            ...(step.params as Parameters<typeof notify.notifyAgencyClientAboutOffers>[0]),
            approved: true,
          });
          if (result.emailSent) emailSent = true;
          chatSent = true;
        }
      } else if (step.kind === 'notify') {
        await sendNotification({
          userId: step.userId,
          type: 'CRM_EVENT',
          title: step.title,
          body: step.body,
          data: step.data,
        }).catch(() => {});
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message.slice(0, 200) : 'Błąd wysyłki.');
    }
  }
  return { emailSent, smsSent, chatSent, errors };
}

/**
 * Jedyna droga wysyłki do klienta w imieniu agenta.
 * `approved: true` tylko wtedy, gdy agent przed chwilą zobaczył dokładnie tę treść i ją zatwierdził.
 */
export async function deliverToClient(params: {
  agencyUserId: number;
  clientId: number;
  category: OutboxCategory;
  source: string;
  steps: OutboxStep[];
  approved?: boolean;
  /** Podgląd dla agenta, gdy kroki są odroczoną akcją (np. gotowy e-mail z ofertą). */
  preview?: { subject?: string | null; html?: string | null; text?: string | null; recipient?: string | null; channels?: string[] };
}): Promise<DeliverResult> {
  const steps = params.steps.filter(Boolean);
  if (!steps.length) {
    return { sent: true, queued: false, outboxId: null, emailSent: false, smsSent: false, chatSent: false };
  }
  if (params.approved || (await isClientAutoSendAllowed(params.clientId, params.category))) {
    const result = await executeSteps(steps);
    return { sent: true, queued: false, outboxId: null, ...result };
  }

  const fromSteps = describeSteps(steps);
  const described = params.preview
    ? {
        channels: params.preview.channels ?? fromSteps.channels,
        recipient: params.preview.recipient ?? fromSteps.recipient,
        subject: params.preview.subject ?? fromSteps.subject,
        previewText:
          params.preview.text ?? (params.preview.html ? htmlToText(params.preview.html) : fromSteps.previewText),
        previewHtml: params.preview.html ?? fromSteps.previewHtml,
      }
    : fromSteps;
  const row = await prisma.crmOutbox.create({
    data: {
      agencyUserId: params.agencyUserId,
      clientId: params.clientId,
      category: params.category,
      source: params.source.slice(0, 64),
      status: 'pending',
      channels: described.channels.join(','),
      recipient: described.recipient,
      subject: described.subject ? described.subject.slice(0, 255) : null,
      previewText: described.previewText,
      previewHtml: described.previewHtml,
      steps: steps as unknown as object,
    },
    select: { id: true },
  });

  const summary: QueuedOutboxSummary = {
    id: row.id,
    clientId: params.clientId,
    category: params.category,
    categoryLabel: OUTBOX_CATEGORIES[params.category],
    channels: described.channels,
    recipient: described.recipient,
    subject: described.subject,
  };
  const collector = requestCollector.getStore();
  if (collector) {
    // Agent jest w aplikacji — zobaczy podgląd od razu, bez dodatkowego powiadomienia.
    collector.push(summary);
  } else {
    const client = await prisma.agencyClient
      .findUnique({ where: { id: params.clientId }, select: { firstName: true, lastName: true } })
      .catch(() => null);
    await sendNotification({
      userId: params.agencyUserId,
      type: 'CRM_EVENT',
      title: 'Wiadomość czeka na Twoją akceptację',
      body: `${client ? `${client.firstName} ${client.lastName}` : 'Klient'} · ${OUTBOX_CATEGORIES[params.category]}`,
      data: crmAgentPushData(params.clientId, {
        kind: 'CRM_OUTBOX',
        outboxId: row.id,
        screen: 'AgencyToday',
        route: 'AgencyToday',
      }),
      idempotencyKey: `crm-outbox-${row.id}`,
    }).catch(() => {});
  }
  return { sent: false, queued: true, outboxId: row.id, emailSent: false, smsSent: false, chatSent: false };
}

/* ───────────── akceptacja w aplikacji ───────────── */

export type OutboxItem = {
  id: number;
  clientId: number;
  clientName: string;
  category: OutboxCategory;
  categoryLabel: string;
  channels: string[];
  recipient: string | null;
  subject: string | null;
  previewText: string | null;
  previewHtml: string | null;
  createdAt: string;
};

function shapeOutbox(row: {
  id: number;
  clientId: number;
  category: string;
  channels: string;
  recipient: string | null;
  subject: string | null;
  previewText: string | null;
  previewHtml: string | null;
  createdAt: Date;
}, clientName: string): OutboxItem {
  const category = (row.category in OUTBOX_CATEGORIES ? row.category : 'assistant') as OutboxCategory;
  return {
    id: row.id,
    clientId: row.clientId,
    clientName,
    category,
    categoryLabel: OUTBOX_CATEGORIES[category],
    channels: row.channels ? row.channels.split(',').filter(Boolean) : [],
    recipient: row.recipient,
    subject: row.subject,
    previewText: row.previewText,
    previewHtml: row.previewHtml,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listPendingOutbox(agencyUserId: number, options: { includeHtml?: boolean } = {}): Promise<OutboxItem[]> {
  const rows = await prisma.crmOutbox.findMany({
    where: { agencyUserId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 60,
  });
  if (!rows.length) return [];
  const clients = await prisma.agencyClient.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.clientId))] } },
    select: { id: true, firstName: true, lastName: true, status: true },
  });
  const byId = new Map(clients.map((client) => [client.id, client]));
  return rows
    .filter((row) => byId.get(row.clientId)?.status === 'ACTIVE')
    .map((row) => {
      const client = byId.get(row.clientId);
      const item = shapeOutbox(row, client ? `${client.firstName} ${client.lastName}`.trim() : 'Klient');
      return options.includeHtml ? item : { ...item, previewHtml: null };
    });
}

export async function getOutboxItem(agencyUserId: number, id: number): Promise<OutboxItem | null> {
  const row = await prisma.crmOutbox.findFirst({ where: { id, agencyUserId } });
  if (!row) return null;
  const client = await prisma.agencyClient.findUnique({
    where: { id: row.clientId },
    select: { firstName: true, lastName: true },
  });
  return shapeOutbox(row, client ? `${client.firstName} ${client.lastName}`.trim() : 'Klient');
}

export async function setClientAutoSend(clientId: number, category: OutboxCategory, enabled: boolean) {
  const client = await prisma.agencyClient.findUnique({ where: { id: clientId }, select: { autoSendCategories: true } });
  const current = new Set(parseAutoSendCategories(client?.autoSendCategories));
  if (enabled) current.add(category);
  else current.delete(category);
  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      autoSendCategories: [...current],
      ...(category === 'offer' ? { intelligenceMode: enabled ? 'AUTOPILOT' : 'APPROVAL' } : {}),
    },
  });
}

/** Agent zatwierdza: wiadomość wychodzi dokładnie w tej formie. Opcjonalnie: „od teraz automatycznie”. */
export async function approveOutbox(params: {
  agencyUserId: number;
  id: number;
  autoFromNow?: boolean;
}): Promise<{ ok: boolean; error?: string; emailSent?: boolean; smsSent?: boolean; chatSent?: boolean }> {
  const claimed = await prisma.crmOutbox.updateMany({
    where: { id: params.id, agencyUserId: params.agencyUserId, status: 'pending' },
    data: { status: 'sending', decidedAt: new Date(), decidedBy: params.agencyUserId },
  });
  if (claimed.count !== 1) return { ok: false, error: 'Ta wiadomość została już rozpatrzona.' };
  const row = await prisma.crmOutbox.findUniqueOrThrow({ where: { id: params.id } });
  const steps = (Array.isArray(row.steps) ? row.steps : []) as unknown as OutboxStep[];
  const result = await executeSteps(steps);
  const failed = !result.emailSent && !result.smsSent && !result.chatSent && result.errors.length > 0;
  await prisma.crmOutbox.update({
    where: { id: row.id },
    data: {
      status: failed ? 'failed' : 'sent',
      sentAt: failed ? null : new Date(),
      error: result.errors.length ? result.errors.join(' · ').slice(0, 500) : null,
    },
  });
  if (params.autoFromNow && !failed) {
    await setClientAutoSend(row.clientId, row.category as OutboxCategory, true);
  }
  if (failed) {
    // Wracamy do kolejki, żeby agent mógł spróbować ponownie.
    await prisma.crmOutbox.update({ where: { id: row.id }, data: { status: 'pending' } });
    return { ok: false, error: result.errors[0] || 'Nie udało się wysłać.' };
  }
  await prisma.agencyClientActivity
    .create({
      data: {
        clientId: row.clientId,
        agencyUserId: params.agencyUserId,
        kind: 'OUTBOX_SENT',
        title: `Wysłano po akceptacji: ${row.subject || OUTBOX_CATEGORIES[row.category as OutboxCategory] || 'wiadomość'}`,
        body: (row.previewText || '').slice(0, 280),
        metadata: { outboxId: row.id, category: row.category, channels: row.channels, agentStatus: 'done' },
      },
    })
    .catch(() => {});
  return { ok: true, emailSent: result.emailSent, smsSent: result.smsSent, chatSent: result.chatSent };
}

export async function cancelOutbox(params: { agencyUserId: number; id: number }): Promise<{ ok: boolean; error?: string }> {
  const updated = await prisma.crmOutbox.updateMany({
    where: { id: params.id, agencyUserId: params.agencyUserId, status: 'pending' },
    data: { status: 'cancelled', decidedAt: new Date(), decidedBy: params.agencyUserId },
  });
  return updated.count === 1 ? { ok: true } : { ok: false, error: 'Ta wiadomość została już rozpatrzona.' };
}

/**
 * Wiadomość w czacie panelu klienta wysyłana w imieniu agenta (np. przez asystenta).
 * Notatki wewnętrzne (audience: 'agent') i wiadomości klienta idą bez bramki.
 */
export async function deliverChatToClient(
  chat: Parameters<typeof sendPortalChat>[0],
  options: { category: OutboxCategory; source: string; approved?: boolean },
) {
  const audience = String((chat.activityMetadata as Record<string, unknown> | undefined)?.audience || '');
  if (chat.from !== 'agent' || audience === 'agent' || chat.activityOnly) {
    return sendPortalChat(chat);
  }
  const delivery = await deliverToClient({
    agencyUserId: chat.agencyUserId,
    clientId: chat.clientId,
    category: options.category,
    source: options.source,
    approved: options.approved,
    steps: [{ kind: 'chat', params: chat }],
  });
  return delivery.queued
    ? { ok: true as const, queued: true as const, outboxId: delivery.outboxId }
    : { ok: true as const, queued: false as const, outboxId: null };
}
