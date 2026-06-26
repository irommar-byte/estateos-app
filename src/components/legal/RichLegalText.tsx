import Link from 'next/link';

const EMAIL_RE = /([a-zA-Z0-9._%+-]+@estateos\.pl)/g;
const MD_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

function renderSegment(segment: string, keyPrefix: string): React.ReactNode[] {
  if (!segment) return [];

  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MD_LINK_RE.source, 'g');

  while ((match = re.exec(segment)) !== null) {
    if (match.index > last) {
      parts.push(segment.slice(last, match.index));
    }
    const href = match[2];
    const label = match[1];
    if (href.startsWith('mailto:') || href.startsWith('http')) {
      parts.push(
        <a key={`${keyPrefix}-a-${match.index}`} className="text-emerald-700 underline" href={href}>
          {label}
        </a>,
      );
    } else {
      parts.push(
        <Link key={`${keyPrefix}-l-${match.index}`} className="text-emerald-700 underline" href={href}>
          {label}
        </Link>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < segment.length) {
    parts.push(segment.slice(last));
  }

  return parts.length > 0 ? parts : [segment];
}

function renderBoldSegments(segment: string, keyPrefix: string): React.ReactNode[] {
  if (!segment) return [];

  const parts: React.ReactNode[] = [];
  const boldRe = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRe.exec(segment)) !== null) {
    if (match.index > last) {
      parts.push(...renderSegment(segment.slice(last, match.index), `${keyPrefix}-bpre-${match.index}`));
    }
    parts.push(<strong key={`${keyPrefix}-bold-${match.index}`}>{match[1]}</strong>);
    last = match.index + match[0].length;
  }

  if (last < segment.length) {
    parts.push(...renderSegment(segment.slice(last), `${keyPrefix}-btail`));
  }

  return parts.length > 0 ? parts : renderSegment(segment, keyPrefix);
}

export default function RichLegalText({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(EMAIL_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...renderBoldSegments(text.slice(last, match.index), `pre-${match.index}`));
    }
    const email = match[1];
    nodes.push(
      <a key={`email-${match.index}`} className="text-emerald-700 underline" href={`mailto:${email}`}>
        {email}
      </a>,
    );
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(...renderBoldSegments(text.slice(last), 'tail'));
  }

  return <>{nodes}</>;
}
