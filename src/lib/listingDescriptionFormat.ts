export type DescriptionSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

export type DescriptionBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; spans: DescriptionSpan[] }
  | { type: 'bullet'; spans: DescriptionSpan[] }
  | { type: 'check'; spans: DescriptionSpan[] }
  | { type: 'separator' };

const CHECK_PREFIX = /^(?:✓|✔|☑|√)\s+/;
const BULLET_PREFIX = /^(?:•|●|◦|–)\s+/;
const MD_BULLET_PREFIX = /^[-*]\s+(?!\*)/;
const SEP_LINE = /^(?:[-–—─_]{3,})$/;
const HEADING_PREFIX = /^(?:#{1,3}\s+)/;

export function parseInlineSpans(raw: string): DescriptionSpan[] {
  const src = String(raw || '');
  if (!src) return [];
  const spans: DescriptionSpan[] = [];
  const tokenRe = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(src))) {
    if (match.index > last) {
      spans.push({ text: src.slice(last, match.index) });
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      spans.push({ text: token.slice(2, -2), bold: true });
    } else if (token.startsWith('__') && token.endsWith('__')) {
      spans.push({ text: token.slice(2, -2), underline: true });
    } else {
      spans.push({ text: token.slice(1, -1), italic: true });
    }
    last = match.index + token.length;
  }
  if (last < src.length) spans.push({ text: src.slice(last) });
  return spans.filter((s) => s.text.length > 0);
}

function spansToEditorial(spans: DescriptionSpan[]): string {
  return spans
    .map((span) => {
      let t = span.text;
      if (span.bold) t = `**${t}**`;
      if (span.underline) t = `__${t}__`;
      if (span.italic) t = `*${t}*`;
      return t;
    })
    .join('');
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function spansToHtml(spans: DescriptionSpan[]): string {
  return spans
    .map((span) => {
      let html = escapeHtml(span.text);
      if (span.bold) html = `<strong>${html}</strong>`;
      if (span.italic) html = `<em>${html}</em>`;
      if (span.underline) html = `<u>${html}</u>`;
      return html;
    })
    .join('');
}

export function htmlToEditorial(html: string): string {
  let text = String(html || '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n\n——————\n\n');
  text = text.replace(/<\/(h2|h3)>/gi, '\n\n');
  text = text.replace(/<(h2|h3)[^>]*>/gi, '\n\n');
  text = text.replace(/<li[^>]*data-kind=["']check["'][^>]*>/gi, '\n✓ ');
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  text = text.replace(/<\/li>/gi, '');
  text = text.replace(/<\/(ul|ol)>/gi, '\n\n');
  text = text.replace(/<(ul|ol)[^>]*>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<\/?(strong|b)>/gi, '**');
  text = text.replace(/<\/?u>/gi, '__');
  text = text.replace(/<\/?(em|i)>/gi, '*');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text;
}

export function parseListingDescription(raw: unknown): DescriptionBlock[] {
  let text = String(raw ?? '').trim();
  if (!text) return [];
  if (/<\s*\/?[a-z][a-z0-9]*\b/i.test(text)) {
    text = htmlToEditorial(text);
  }

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: DescriptionBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    const joined = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    paragraph = [];
    if (!joined) return;
    blocks.push({ type: 'paragraph', spans: parseInlineSpans(joined) });
  };

  for (const original of lines) {
    const line = original.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    if (SEP_LINE.test(line.replace(/\s/g, ''))) {
      flushParagraph();
      if (blocks.at(-1)?.type !== 'separator') blocks.push({ type: 'separator' });
      continue;
    }
    const looksLikeHeading =
      HEADING_PREFIX.test(line) ||
      (/^[A-ZĄĆĘŁŃÓŚŹŻ][A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż ]{1,40}$/.test(line) &&
        !CHECK_PREFIX.test(line) &&
        !BULLET_PREFIX.test(line));
    if (looksLikeHeading) {
      const heading = line.replace(HEADING_PREFIX, '').trim();
      if (heading.length <= 42 && paragraph.length === 0) {
        flushParagraph();
        blocks.push({ type: 'heading', text: heading });
        continue;
      }
    }
    if (CHECK_PREFIX.test(line)) {
      flushParagraph();
      blocks.push({ type: 'check', spans: parseInlineSpans(line.replace(CHECK_PREFIX, '')) });
      continue;
    }
    if (BULLET_PREFIX.test(line) || MD_BULLET_PREFIX.test(line)) {
      flushParagraph();
      const body = line.replace(BULLET_PREFIX, '').replace(MD_BULLET_PREFIX, '');
      blocks.push({ type: 'bullet', spans: parseInlineSpans(body) });
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  return blocks;
}

export function editorialToHtml(raw: unknown): string {
  const blocks = parseListingDescription(raw);
  if (!blocks.length) return '';
  const parts: string[] = [];
  let listKind: 'bullet' | 'check' | null = null;

  const closeList = () => {
    if (listKind) {
      parts.push('</ul>');
      listKind = null;
    }
  };

  for (const block of blocks) {
    if (block.type === 'bullet' || block.type === 'check') {
      const nextKind = block.type;
      if (listKind && listKind !== nextKind) closeList();
      if (!listKind) {
        parts.push('<ul>');
        listKind = nextKind;
      }
      const attr = nextKind === 'check' ? ' data-kind="check"' : '';
      parts.push(`<li${attr}>${spansToHtml(block.spans)}</li>`);
      continue;
    }
    closeList();
    if (block.type === 'separator') {
      parts.push('<hr>');
      continue;
    }
    if (block.type === 'heading') {
      parts.push(`<h3>${escapeHtml(block.text)}</h3>`);
      continue;
    }
    parts.push(`<p>${spansToHtml(block.spans)}</p>`);
  }
  closeList();
  return parts.join('');
}

export function blocksToEditorial(blocks: DescriptionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    if (block.type === 'separator') {
      lines.push('', '——————', '');
      continue;
    }
    if (block.type === 'heading') {
      lines.push('', block.text, '');
      continue;
    }
    if (block.type === 'bullet') {
      lines.push(`• ${spansToEditorial(block.spans)}`);
      continue;
    }
    if (block.type === 'check') {
      lines.push(`✓ ${spansToEditorial(block.spans)}`);
      continue;
    }
    lines.push('', spansToEditorial(block.spans), '');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function toEditorialForEditor(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (/<\s*\/?[a-z][a-z0-9]*\b/i.test(text)) return htmlToEditorial(text);
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export type EditorialMarkKind =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'heading'
  | 'bullet'
  | 'check'
  | 'separator'
  | 'emoji';

export const DESCRIPTION_EMOJI_PRESETS = [
  '🏠',
  '🌳',
  '🚗',
  '✅',
  '📍',
  '☀️',
  '🛗',
  '🅿️',
  '✨',
  '💎',
  '🌿',
  '🏡',
] as const;

function lineBreakBefore(value: string, index: number): string {
  if (index <= 0) return '';
  return value[index - 1] === '\n' ? '' : '\n';
}

function toggleInlineWrap(
  value: string,
  start: number,
  end: number,
  wrap: string,
  placeholder: string,
): { text: string; start: number; end: number } {
  const selected = value.slice(start, end);
  const inner = selected || placeholder;
  if (
    selected &&
    selected.startsWith(wrap) &&
    selected.endsWith(wrap) &&
    selected.length >= wrap.length * 2
  ) {
    const unwrapped = selected.slice(wrap.length, -wrap.length);
    const next = `${value.slice(0, start)}${unwrapped}${value.slice(end)}`;
    return { text: next, start, end: start + unwrapped.length };
  }
  const insert = `${wrap}${inner}${wrap}`;
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
  return { text: next, start: start + wrap.length, end: start + wrap.length + inner.length };
}

export function insertEditorialMark(
  text: string,
  selection: { start: number; end: number },
  kind: EditorialMarkKind,
  emoji?: string,
): { text: string; start: number; end: number } {
  const value = String(text || '');
  const start = Math.max(0, selection.start);
  const end = Math.max(start, selection.end);
  const selected = value.slice(start, end);

  if (kind === 'separator') {
    const prefix = lineBreakBefore(value, start);
    const insert = `${prefix}——————\n`;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const caret = start + insert.length;
    return { text: next, start: caret, end: caret };
  }

  if (kind === 'bold') {
    return toggleInlineWrap(value, start, end, '**', 'wyróżnienie');
  }
  if (kind === 'italic') {
    return toggleInlineWrap(value, start, end, '*', 'akcent');
  }
  if (kind === 'underline') {
    return toggleInlineWrap(value, start, end, '__', 'podkreślenie');
  }

  if (kind === 'heading') {
    const label = selected.trim() || 'Atuty lokalu';
    const prefix = start > 0 && value[start - 1] !== '\n' ? '\n\n' : start > 0 ? '\n' : '';
    const insert = `${prefix}${label}\n`;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const caret = start + insert.length;
    return { text: next, start: caret, end: caret };
  }

  if (kind === 'emoji') {
    const glyph = String(emoji || '✨');
    const insert = selected ? `${glyph} ${selected}` : `${glyph} `;
    const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
    const caret = start + insert.length;
    return { text: next, start: caret, end: caret };
  }

  const prefix = kind === 'check' ? '✓ ' : '• ';
  const inner = selected || '';
  const linePrefix = lineBreakBefore(value, start);
  const insert = `${linePrefix}${prefix}${inner}`;
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`;
  const caret = start + insert.length;
  return { text: next, start: caret, end: caret };
}
