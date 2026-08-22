'use client';

import type { CSSProperties, ImgHTMLAttributes } from 'react';
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
 * Adaptacyjne wyświetlanie: HDR master gdy urządzenie/przeglądarka wspiera, inaczej SDR fallback.
 * Używa <picture> + media queries — bez pseudo-HDR przez CSS filter.
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
  const masterUrl = meta?.hdrDisplayUrl || meta?.masterUrl;
  const masterType = masterMimeType(meta);
  const masterIsHeic = masterType === 'image/heic' || masterType === 'image/heif';

  const canUseMaster =
    ready && isHdr && masterUrl && hdrCapable && (!masterIsHeic || heicInPicture);

  if (isHdr && masterUrl) {
    return (
      <span className={`relative block ${className}`.trim()}>
        <picture>
          {canUseMaster ? (
            <source
              srcSet={masterUrl}
              type={masterType}
              media="(dynamic-range: high), (color-gamut: p3), (color-gamut: rec2020)"
            />
          ) : null}
          <img
            src={sdrSrc}
            alt={alt}
            className={imgClassName}
            draggable={draggable}
            loading={loading}
            fetchPriority={fetchPriority}
            width={meta?.width}
            height={meta?.height}
            onClick={onClick}
            style={style}
          />
        </picture>
        {showHdrBadge && isHdr ? <OfferHdrBadge compact={badgeCompact} /> : null}
      </span>
    );
  }

  return (
    <span className={`relative block ${className}`.trim()}>
      <img
        src={sdrSrc}
        alt={alt}
        className={imgClassName}
        draggable={draggable}
        loading={loading}
        fetchPriority={fetchPriority}
        width={meta?.width}
        height={meta?.height}
        onClick={onClick}
        style={style}
      />
      {showHdrBadge && isHdr ? <OfferHdrBadge compact={badgeCompact} /> : null}
    </span>
  );
}
