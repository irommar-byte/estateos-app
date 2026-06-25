import { ImageResponse } from 'next/og';
import { loadOfferShareCard } from '@/lib/offerShareLanding';

export const runtime = 'nodejs';
export const alt = 'Oferta nieruchomości — EstateOS™';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ id: string }> };

export default async function OfferOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const card = await loadOfferShareCard(Number(id));

  const title = card?.title || 'Oferta nieruchomości';
  const subtitle = card?.summaryLine || 'EstateOS™';
  const price = card?.priceLabel || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'linear-gradient(145deg, #0a0a0c 0%, #141416 55%, #0f766e 120%)',
          fontFamily: 'system-ui, sans-serif',
          padding: 56,
        }}
      >
        <div style={{ fontSize: 22, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#10b981', marginBottom: 16 }}>
          EstateOS™
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1.1, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ marginTop: 20, fontSize: 28, color: 'rgba(255,255,255,0.82)' }}>{subtitle}</div>
        {price ? (
          <div style={{ marginTop: 16, fontSize: 36, fontWeight: 700, color: '#f9e498' }}>{price}</div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}
