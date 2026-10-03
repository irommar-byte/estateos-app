/** Wspólny kształt podglądu wysyłki do klienta (agent zatwierdza przed send). */
export type ClientOutboundPreview = {
  kind: 'schedule' | 'visit_prep' | 'offers';
  to: string | null;
  subject: string;
  bodyPreview: string;
  smsBody: string | null;
  html: string | null;
  channels: Array<'email' | 'sms' | 'portal'>;
};

export function stripEmailHtml(html: string): string {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
