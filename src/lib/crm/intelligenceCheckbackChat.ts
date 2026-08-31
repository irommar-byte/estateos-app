import type { CheckbackOption } from '@/lib/crm/intelligenceDialogue';

export function normalizeChatReplyText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const YES_EXACT = new Set([
  'tak',
  'ta',
  'yes',
  'y',
  'ok',
  'okay',
  'pewnie',
  'jasne',
  'zgadza sie',
  'dokladnie',
  'exactly',
  'potwierdzam',
  'oczywiscie',
  'no tak',
  'aha',
  'yup',
  'sure',
  'nom',
  'no pewnie',
]);

const NO_EXACT = new Set([
  'nie',
  'no',
  'nope',
  'poprawie',
  'inaczej',
  'zle',
  'to nie tak',
  'nie zgadza sie',
  'blad',
]);

function looksLikeYes(text: string): boolean {
  const normalized = normalizeChatReplyText(text);
  if (!normalized) return false;
  if (/\btak\b/.test(normalized) && /\bnie\b/.test(normalized)) return false;
  if (looksLikeNo(text)) return false;
  if (/\bnie\s+wiem\b/.test(normalized) || normalized === 'nie wiem') return false;
  if (YES_EXACT.has(normalized)) return true;
  if (/^(tak|yes|ok|pewnie|jasne|dokladnie|zgadza)[\s,.!]*$/i.test(text.trim())) return true;
  if (/\bdokladnie\b/.test(normalized)) return true;
  if (/\bzgadza\s+sie\b/.test(normalized)) return true;
  if (/\btak\b/.test(normalized) && normalized.length <= 24) return true;
  return false;
}

function looksLikeNo(text: string): boolean {
  const normalized = normalizeChatReplyText(text);
  if (!normalized) return false;
  if (/\bnie\s+wiem\b/.test(normalized)) return false;
  if (/\btak\b/.test(normalized) && /\bnie\b/.test(normalized)) return true;
  if (NO_EXACT.has(normalized)) return true;
  if (/^nie[\s,.!-]/i.test(text.trim()) || normalized === 'nie') return true;
  if (/\bnie\s+popraw/i.test(normalized)) return true;
  if (/\bpopraw/i.test(normalized) && normalized.length <= 32) return true;
  return false;
}

/** Maps free-text chat to a checkback option id, or null when unrelated / ambiguous. */
export function mapChatTextToCheckbackOption(
  text: string,
  options: CheckbackOption[],
): string | null | 'ambiguous' {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 160) return null;

  const ids = new Set(options.map((item) => item.id));
  const hasYesNo = ids.has('yes') && ids.has('no');

  if (hasYesNo) {
    const normalized = normalizeChatReplyText(trimmed);
    if (/\btak\b/.test(normalized) && /\bnie\b/.test(normalized)) return 'ambiguous';
    if (/\bnie\s+wiem\b/.test(normalized)) return 'ambiguous';
    const yes = looksLikeYes(trimmed);
    const no = looksLikeNo(trimmed);
    if (yes && no) return 'ambiguous';
    if (yes) return 'yes';
    if (no) return 'no';
    return null;
  }

  const normalized = normalizeChatReplyText(trimmed);
  for (const option of options) {
    const labelNorm = normalizeChatReplyText(option.label);
    if (!labelNorm) continue;
    if (normalized === labelNorm) return option.id;
    if (normalized.length >= 4 && labelNorm.includes(normalized)) return option.id;
    if (labelNorm.length >= 4 && normalized.includes(labelNorm)) return option.id;
  }

  if (ids.has('stay_budget') && /\b(obecn\w*|tym|ten)\s+bud\w*/.test(normalized)) {
    return 'stay_budget';
  }
  if (ids.has('raise_budget') && /\b(ryn\w*|blizej|wiecej|podnies\w*|drozej)\b/.test(normalized)) {
    return 'raise_budget';
  }
  if (ids.has('keep_balcony') && /\b(balkon|zostaw)\b/.test(normalized) && !looksLikeNo(trimmed)) {
    return 'keep_balcony';
  }
  if (ids.has('allow_without_balcony') && /\b(bez\s+balkon|moze\s+byc\s+bez)\b/.test(normalized)) {
    return 'allow_without_balcony';
  }

  return null;
}

export function buildCheckbackChoicePrompt(options: CheckbackOption[]): string {
  const labels = options.map((item) => `• ${item.label}`).join('\n');
  return [
    'Żeby dobrze zrozumieć Twoją odpowiedź, wybierz proszę jedną z opcji poniżej (albo napisz krótko „tak” albo „nie”).',
    labels,
  ].join('\n');
}

export type PortalCheckbackQuickReply = {
  activityId: number;
  options: CheckbackOption[];
};
