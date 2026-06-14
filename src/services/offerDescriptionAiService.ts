import { API_URL } from '../config/network';

export type ListingDescriptionDraftPayload = Record<string, unknown> & {
  locale?: string;
};

export type GenerateListingDescriptionResult = {
  description: string;
  model?: string;
};

export async function generateListingDescriptionWithGpt(
  token: string,
  draft: ListingDescriptionDraftPayload,
  locale: string,
): Promise<GenerateListingDescriptionResult> {
  const res = await fetch(`${API_URL}/api/mobile/v1/offers/description/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...draft, locale }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !String(data?.description || '').trim()) {
    throw new Error(String(data?.error || 'Nie udało się wygenerować opisu GPT.'));
  }

  return {
    description: String(data.description).trim(),
    model: data.model ? String(data.model) : undefined,
  };
}
