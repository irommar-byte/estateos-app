import { inferAmenitySuggestions } from '@/lib/intelligenceAmenityBrain';
import type { OtodomImportDraft } from '@/lib/otodomImport';

export function suggestionsFromImportDraft(draft: OtodomImportDraft) {
  return inferAmenitySuggestions({
    features: draft.features,
    title: draft.title,
    description: [draft.descriptionText, draft.descriptionHtml].filter(Boolean).join('\n'),
  });
}

export async function buildSmartAddPreview(_userId: number, draft: OtodomImportDraft) {
  return {
    smartAddEnabled: true,
    smartAddSuggestions: suggestionsFromImportDraft(draft),
  };
}

export async function resolveSmartAddCreateOptions(
  _userId: number,
  body: Record<string, unknown>,
  _mode: 'interactive' | 'auto' = 'interactive',
) {
  return {
    smartAddEnabled: true,
    smartAddAutoApply: true,
    smartAddDecisions: body.smartAddDecisions,
  };
}
