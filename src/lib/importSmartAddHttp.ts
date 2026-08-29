import { inferAmenitySuggestions, previewImportSmartAdd } from '@/lib/intelligenceAmenityBrain';
import { SMART_ADD_ALWAYS_ON } from '@/lib/intelligenceSmartAdd';
import type { OtodomImportDraft } from '@/lib/otodomImport';

export function suggestionsFromImportDraft(draft: OtodomImportDraft) {
  return inferAmenitySuggestions({
    features: draft.features,
    title: draft.title,
    description: [draft.descriptionText, draft.descriptionHtml].filter(Boolean).join('\n'),
  });
}

export async function buildSmartAddPreview(_userId: number, draft: OtodomImportDraft) {
  const preview = previewImportSmartAdd(draft);
  return {
    smartAddEnabled: SMART_ADD_ALWAYS_ON,
    smartAddSuggestions: preview.suggestions,
    smartAddPreview: preview,
  };
}

export async function resolveSmartAddCreateOptions(
  _userId: number,
  body: Record<string, unknown>,
  _mode: 'interactive' | 'auto' = 'interactive',
) {
  return {
    smartAddEnabled: SMART_ADD_ALWAYS_ON,
    smartAddAutoApply: SMART_ADD_ALWAYS_ON,
    smartAddDecisions: body.smartAddDecisions,
  };
}
