import { API_URL } from '../config/network';

export const CONTACT_ATTACHMENT_PREFIX = '[[CONTACT_ATTACHMENT]]';

export const MAX_CONTACT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CONTACT_THREAD_BYTES = 100 * 1024 * 1024;

export type ContactAttachmentMeta = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

export function normalizeContactMediaUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (/^(https?|file|content):\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/')) return `${API_URL}${s}`;
  return `${API_URL}/${s.replace(/^\//, '')}`;
}

function parseContactAttachmentMeta(raw: unknown): ContactAttachmentMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const url = normalizeContactMediaUrl(String(o.url || '').trim());
  const name = String(o.name || 'Załącznik').trim();
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

  const url = normalizeContactMediaUrl(String(msg.attachment || '').trim());
  if (url) {
    const name = url.split('/').pop() || 'Załącznik';
    return {
      text: content.replace(/\[\[CONTACT_ATTACHMENT\]\][\s\S]*/, '').trim(),
      attachment: { url, name, mimeType: guessMimeFromName(name), size: 0 },
    };
  }

  return { text: content, attachment: null };
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

export function formatContactBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
