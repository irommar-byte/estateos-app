import { ImageResponse } from 'next/og';
import { loadCarShareMeta } from '@/lib/carShareLanding';

export const runtime = 'nodejs';
export const alt = 'Ogłoszenie auta — EstateOS™Car';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Props = { params: Promise<{ id: string }> };

export default async function CarOpenGraphImage({ params }: Props) {
  const { id } = await params;
  const meta = await loadCarShareMeta(Number(id));

  const title = meta?.title || 'Ogłoszenie auta';
  const price = meta?.priceLabel || '';
  const subtitle = meta?.ogDescription?.split('.')[0] || 'EstateOS™Car';
  const photo = meta?.photoUrl || '';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background: '#0b1220',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            width: photo ? '58%' : '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            background: 'linear-gradient(145deg, #020617 0%, #0c4a6e 55%, #082f49 120%)',
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={700}
              height={630}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : null}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: photo
                ? 'linear-gradient(90deg, rgba(2,6,23,0.15) 40%, rgba(2,6,23,0.92) 100%)'
                : 'transparent',
            }}
          />
        </div>

        <div
          style={{
            width: photo ? '42%' : '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: 48,
            background: photo ? '#0b1220' : 'transparent',
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#38bdf8',
              marginBottom: 18,
            }}
          >
            EstateOS™Car
          </div>
          <div
            style={{
              fontSize: photo ? 36 : 48,
              fontWeight: 800,
              color: 'white',
              lineHeight: 1.12,
              maxWidth: 460,
            }}
          >
            {title.length > 70 ? `${title.slice(0, 67)}…` : title}
          </div>
          <div style={{ marginTop: 16, fontSize: 22, color: 'rgba(226,232,240,0.88)', maxWidth: 440 }}>
            {subtitle.length > 90 ? `${subtitle.slice(0, 87)}…` : subtitle}
          </div>
          {price ? (
            <div style={{ marginTop: 18, fontSize: 34, fontWeight: 800, color: '#fde68a' }}>{price}</div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
