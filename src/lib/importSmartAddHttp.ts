import { getIntelligenceSmartAddEnabled } from '@/lib/intelligenceSmartAdd';
import { inferAmenitySuggestions } from '@/lib/intelligenceAmenityBrain';
import type { OtodomImportDraft } from '@/lib/otodomImport';

export function suggestionsFromImportDraft(draft: OtodomImportDraft) {
  return inferAmenitySuggestions({
    features: draft.features,
    title: draft.title,
    description: [draft.descriptionText, draft.descriptionHtml].filter(Boolean).join('\n'),
  });
}

export async function buildSmartAddPreview(userId: number, draft: OtodomImportDraft) {
  const enabled = await getIntelligenceSmartAddEnabled(userId);
  return {
    smartAddEnabled: enabled,
    smartAddSuggestions: enabled ? suggestionsFromImportDraft(draft) : [],
  };
}

export async function resolveSmartAddCreateOptions(
  userId: number,
  body: Record<string, unknown>,
  mode: 'interactive' | 'auto' = 'interactive',
) {
  const enabled =
    typeof body.smartAddEnabled === 'boolean'
      ? body.smartAddEnabled
      : await getIntelligenceSmartAddEnabled(userId);
  return {
    smartAddEnabled: enabled,
    smartAddAutoApply: mode === 'auto',
    smartAddDecisions: body.smartAddDecisions,
  };
}
