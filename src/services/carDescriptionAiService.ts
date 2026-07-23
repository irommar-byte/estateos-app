import { API_URL } from '../config/network';

export type CarDescriptionDraftPayload = Record<string, unknown> & {
  locale?: string;
  userNotes?: string;
  existingDescription?: string;
};

export type GenerateCarDescriptionResult = {
  description: string;
  model?: string;
};

export async function generateCarListingDescriptionWithGpt(
  token: string,
  draft: CarDescriptionDraftPayload,
  locale: string,
): Promise<GenerateCarDescriptionResult> {
  const res = await fetch(`${API_URL}/api/mobile/v1/cars/description/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...draft, locale }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !String(data?.description || '').trim()) {
    throw new Error(String(data?.error || 'Nie udało się wygenerować opisu auta.'));
  }

  return {
    description: String(data.description).trim(),
    model: data.model ? String(data.model) : undefined,
  };
}
