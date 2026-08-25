import { redirect } from 'next/navigation';
import { OG_CARD_VERSION } from '@/lib/buildShareOgJpeg';

export const runtime = 'nodejs';
export const alt = 'Oferta nieruchomości — EstateOS™';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

type Props = { params: Promise<{ id: string }> };

/** Legacy path — przekieruj na szybki JPEG z cache. */
export default async function OfferOpenGraphImage({ params }: Props) {
  const { id } = await params;
  redirect(`/api/og/offer/${id}?${OG_CARD_VERSION}`);
}
