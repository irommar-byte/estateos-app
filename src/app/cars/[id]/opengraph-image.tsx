import { ImageResponse } from 'next/og';
import { loadCarShareMeta } from '@/lib/carShareLanding';
import { fetchImageAsJpegDataUrl } from '@/lib/ogShareImage';

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
  const photo = await fetchImageAsJpegDataUrl(meta?.photoUrl || '', {
    width: 1200,
    height: 630,
  });

  const shortTitle = title.length > 64 ? `${title.slice(0, 61)}…` : title;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: '#e8eef5',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={1200}
            height={630}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(135deg, #f8fafc 0%, #e0f2fe 45%, #bae6fd 100%)',
            }}
          />
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: photo
              ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(248,250,252,0.12) 42%, rgba(15,23,42,0.52) 100%)'
              : 'transparent',
          }}
        />

        <div
          style={{
            position: 'absolute',
            left: 36,
            right: 36,
            bottom: 32,
            display: 'flex',
            flexDirection: 'column',
            padding: '28px 32px',
            borderRadius: 28,
            background: 'rgba(255,255,255,0.94)',
            boxShadow: '0 18px 40px rgba(15,23,42,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 820 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: '#0284c7',
                  marginBottom: 10,
                }}
              >
                EstateOS™Car
              </div>
              <div
                style={{
                  fontSize: 38,
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.12,
                }}
              >
                {shortTitle}
              </div>
              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 600, color: '#475569' }}>
                {subtitle.length > 88 ? `${subtitle.slice(0, 85)}…` : subtitle}
              </div>
            </div>
            {price ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  padding: '14px 20px',
                  borderRadius: 18,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8', letterSpacing: '0.08em' }}>
                  CENA
                </div>
                <div style={{ marginTop: 4, fontSize: 32, fontWeight: 900, color: '#1e3a8a' }}>{price}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
