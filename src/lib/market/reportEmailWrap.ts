export function wrapReportEmailWithPortal(html: string, portalUrl?: string | null) {
  const href = String(portalUrl || '').trim();
  if (!href) return html;
  const banner = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1f18;color:#fff;padding:22px 24px;border-radius:18px;margin:0 0 22px">
    <p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#86efac;font-weight:800">EstateOS™ · raport dla klienta</p>
    <p style="margin:10px 0 0;font-size:18px;font-weight:800;line-height:1.35">Dokument zapisaliśmy też w Państwa panelu współpracy.</p>
    <p style="margin:8px 0 0;font-size:14px;line-height:1.5;color:rgba(255,255,255,.82)">Zawsze można go tam otworzyć ponownie — nie trzeba szukać w skrzynce.</p>
    <p style="margin:16px 0 0"><a href="${href.replace(/"/g, '&quot;')}" style="display:inline-block;background:#10b981;color:#052e1c;padding:12px 18px;border-radius:999px;font-weight:800;text-decoration:none">Otwórz raport w panelu</a></p>
  </div>`;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (open) => `${open}\n${banner}`);
  }
  return `${banner}${html}`;
}
