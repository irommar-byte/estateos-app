'use client';

import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from 'react';
import type { OfferImageMetaPublic } from '@/lib/upload/offerImageMeta';
import { useHdrDisplayCapability } from '@/hooks/useHdrDisplayCapability';
import { OfferHdrBadge } from '@/components/offer/OfferHdrBadge';

type Props = {
  sdrSrc: string;
  meta?: OfferImageMetaPublic | null;
  className?: string;
  imgClassName?: string;
  showHdrBadge?: boolean;
  badgeCompact?: boolean;
} & Pick<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'draggable' | 'loading' | 'onClick' | 'fetchPriority'> & {
    style?: CSSProperties;
  };

function masterMimeType(meta?: OfferImageMetaPublic | null): string | undefined {
  if (meta?.masterMime) return meta.masterMime;
  const url = meta?.masterUrl || meta?.hdrDisplayUrl || '';
  if (/\.heic/i.test(url)) return 'image/heic';
  if (/\.heif/i.test(url)) return 'image/heif';
  if (/\.jpe?g/i.test(url)) return 'image/jpeg';
  if (/\.png/i.test(url)) return 'image/png';
  return undefined;
}

/**
 * Adaptacyjne wyświetlanie: na Safari/iOS `<img src={master HEIC}>` (gain map / HDR),
 * w pozostałych przeglądarkach SDR WebP. Nie używamy <picture>+source, bo Safari
 * często zostaje przy fallbacku i nie rozświetla świateł.
 */
export function OfferAdaptiveImage({
  sdrSrc,
  meta,
  className = '',
  imgClassName = '',
  showHdrBadge = false,
  badgeCompact = false,
  alt = '',
  draggable,
  loading,
  fetchPriority,
  onClick,
  style,
}: Props) {
  const { hdrCapable, heicInPicture, ready } = useHdrDisplayCapability();
  const isHdr = Boolean(meta?.isHdr);
  const masterUrl = meta?.hdrDisplayUrl || meta?.masterUrl || '';
  const masterType = masterMimeType(meta);
  const masterIsHeic = masterType === 'image/heic' || masterType === 'image/heif';
  const canUseMaster =
    ready && isHdr && Boolean(masterUrl) && hdrCapable && (!masterIsHeic || heicInPicture);

  const preferred = canUseMaster ? masterUrl : sdrSrc;
  const [src, setSrc] = useState(sdrSrc);

  useEffect(() => {
    setSrc(preferred || sdrSrc);
  }, [preferred, sdrSrc]);

  const imgStyle: CSSProperties = {
    ...style,
    dynamicRangeLimit: 'no-limit',
  } as CSSProperties;

  return (
    <span className={`relative block ${className}`.trim()}>
      <img
        src={src}
        alt={alt}
        className={imgClassName}
        draggable={draggable}
        loading={loading}
        fetchPriority={fetchPriority}
        width={meta?.width}
        height={meta?.height}
        onClick={onClick}
        onError={() => {
          if (src !== sdrSrc) setSrc(sdrSrc);
        }}
        style={imgStyle}
      />
      {showHdrBadge && isHdr ? <OfferHdrBadge compact={badgeCompact} /> : null}
    </span>
  );
}
