export const CONTACT_ATTACHMENT_PREFIX = '[[CONTACT_ATTACHMENT]]';

export const MAX_CONTACT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CONTACT_THREAD_BYTES = 100 * 1024 * 1024;

export type ContactAttachmentMeta = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export type ContactThreadAttachmentRow = ContactAttachmentMeta & {
  messageId: number;
  senderId: number;
  createdAt: string;
};

function safelyDecodeAttachmentName(value: string): string {
  let decoded = value;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  return decoded;
}

export function formatContactAttachmentName(raw: string | null | undefined, fallback = 'Załącznik'): string {
  const source = String(raw || '').trim();
  if (!source) return fallback;
  const withoutQuery = source.split(/[?#]/, 1)[0] || source;
  const basename = withoutQuery.split(/[\\/]/).pop() || withoutQuery;
  const decoded = safelyDecodeAttachmentName(basename)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || fallback;
}

export function contactAttachmentPreviewLabel(meta: ContactAttachmentMeta): string {
  const kind = contactAttachmentKind(meta);
  if (kind === 'audio') return '🎵 Nagranie audio';
  if (kind === 'image') return '🖼 Zdjęcie';
  if (kind === 'video') return '🎬 Wideo';
  if (kind === 'pdf') return '📄 Dokument PDF';
  return '📎 Załącznik';
}

export function cleanAttachmentOnlyMessage(
  content: string | null | undefined,
  attachments: ContactAttachmentMeta[] | null | undefined,
): string {
  const text = String(content || '').trim();
  if (!text || !attachments?.length) return text;
  const normalizedText = safelyDecodeAttachmentName(text.replace(/^📎\s*/, '')).trim().toLocaleLowerCase('pl-PL');
  const duplicatesAttachmentName = attachments.some((attachment) => {
    const rawName = String(attachment.name || '').trim().toLocaleLowerCase('pl-PL');
    const displayName = formatContactAttachmentName(attachment.name).toLocaleLowerCase('pl-PL');
    return normalizedText === rawName || normalizedText === displayName;
  });
  return duplicatesAttachmentName ? '' : text;
}

const ALLOWED_EXT = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'heif',
  'pdf',
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'aac',
  'flac',
  'mp4',
  'mov',
  'webm',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'rar',
  '7z',
]);

const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'text/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/octet-stream',
]);

export function formatContactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAllowedContactAttachment(mimeType: string, filename: string): boolean {
  const mime = String(mimeType || '').toLowerCase().trim();
  const ext = String(filename || '')
    .toLowerCase()
    .split('.')
    .pop();
  if (ext && ALLOWED_EXT.has(ext)) return true;
  if (mime && ALLOWED_MIME_EXACT.has(mime)) return true;
  if (mime && ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) return true;
  return false;
}

export function encodeContactAttachmentMessage(
  caption: string,
  meta: ContactAttachmentMeta
): { content: string; attachment: string } {
  const payload = JSON.stringify(meta);
  const trimmed = String(caption || '').trim();
  const content = trimmed
    ? `${trimmed}\n${CONTACT_ATTACHMENT_PREFIX}${payload}`
    : `${CONTACT_ATTACHMENT_PREFIX}${payload}`;
  return { content, attachment: meta.url };
}

export function parseContactAttachmentMeta(raw: unknown): ContactAttachmentMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = String(o.url || '').trim();
  const name = formatContactAttachmentName(String(o.name || 'Załącznik'));
  const mimeType = String(o.mimeType || 'application/octet-stream').trim();
  const size = Number(o.size);
  if (!url) return null;
  return {
    url,
    name,
    mimeType,
    size: Number.isFinite(size) && size >= 0 ? size : 0,
  };
}

export function parseContactMessageParts(msg: {
  content: string;
  attachment?: string | null;
}): { text: string; attachment: ContactAttachmentMeta | null } {
  const content = String(msg.content || '');
  const markerIdx = content.indexOf(CONTACT_ATTACHMENT_PREFIX);
  if (markerIdx >= 0) {
    const text = content.slice(0, markerIdx).trim();
    const jsonPart = content.slice(markerIdx + CONTACT_ATTACHMENT_PREFIX.length).trim();
    try {
      const meta = parseContactAttachmentMeta(JSON.parse(jsonPart));
      if (meta) return { text, attachment: meta };
    } catch {
      /* fall through */
    }
  }

  const url = String(msg.attachment || '').trim();
  if (url) {
    const name = url.split('/').pop() || 'Załącznik';
    return {
      text: content.replace(/\[\[CONTACT_ATTACHMENT\]\][\s\S]*/, '').trim(),
      attachment: { url, name, mimeType: guessMimeFromName(name), size: 0 },
    };
  }

  return { text: content, attachment: null };
}

function guessMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

export function contactAttachmentKind(
  meta: ContactAttachmentMeta
): 'image' | 'audio' | 'video' | 'pdf' | 'file' {
  const mime = meta.mimeType.toLowerCase();
  const name = meta.name.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(name)) return 'image';
  if (mime.startsWith('audio/') || /\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(name)) return 'audio';
  if (mime.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(name)) return 'video';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'file';
}

export function formatContactLastMessagePreview(msg: {
  content: string;
  attachment?: string | null;
}): string {
  const { text, attachment } = parseContactMessageParts(msg);
  if (text) return text;
  if (!attachment) return '';
  const kind = contactAttachmentKind(attachment);
  if (kind === 'pdf') return '📎 Załącznik PDF';
  if (kind === 'audio') return '🎵 Plik audio';
  if (kind === 'image') return '🖼 Zdjęcie';
  if (kind === 'video') return '🎬 Wideo';
  return `📎 ${attachment.name || 'Załącznik'}`;
}
