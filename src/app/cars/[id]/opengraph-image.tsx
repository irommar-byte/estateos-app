import { redirect } from 'next/navigation';
import { carOgImagePath } from '@/lib/ogCardVersion';

export const runtime = 'nodejs';
export const alt = 'Ogłoszenie auta — EstateOS™Car';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

type Props = { params: Promise<{ id: string }> };

/** Legacy path — przekieruj na szybki JPEG z cache. */
export default async function CarOpenGraphImage({ params }: Props) {
  const { id } = await params;
  redirect(carOgImagePath(Number(id)));
}
