'use client';

import { useState } from 'react';
import { Building2, FileText } from 'lucide-react';
import { isPdfMediaUrl, resolveProfileMediaUrl } from '@/lib/agentProfile';

export default function ProfileMediaAvatar({
  src,
  alt,
  className = 'size-full object-cover',
  fallbackClassName = 'flex size-full items-center justify-center bg-emerald-500/10 text-emerald-500',
  iconSize = 28,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  iconSize?: number;
}) {
  const [broken, setBroken] = useState(false);
  const url = resolveProfileMediaUrl(src);

  if (!url || broken) {
    return (
      <div className={fallbackClassName}>
        <Building2 size={iconSize} />
      </div>
    );
  }

  if (isPdfMediaUrl(url)) {
    return (
      <div className={fallbackClassName}>
        <FileText size={iconSize} />
        <span className="sr-only">Dokument PDF</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt || ''} className={className} onError={() => setBroken(true)} />
  );
}
