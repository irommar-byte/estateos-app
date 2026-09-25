import { escapeAcquisitionHtml } from '@/lib/crm/acquisitionDocument';

export type AttendanceDocInput = {
  documentId: string;
  agencyName: string;
  agentName: string;
  agentPhone: string | null;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientPesel: string | null;
  offerId: number;
  offerTitle: string;
  offerAddress: string;
  offerPriceLabel: string | null;
  viewingAtLabel: string;
  viewingDatePart: string;
  viewingTimePart: string;
  signatureDataUrl: string | null;
  signedAtLabel: string;
  logoAbsoluteUrl: string;
};

export function buildPresentationAttendanceHtml(input: AttendanceDocInput): string {
  const e = escapeAcquisitionHtml;
  const peselRow = input.clientPesel
    ? `<p style="margin:4px 0">PESEL: <strong>${e(input.clientPesel)}</strong></p>`
    : '';
  const priceRow = input.offerPriceLabel
    ? `<p style="margin:4px 0">Cena: ${e(input.offerPriceLabel)}</p>`
    : '';
  const sig = input.signatureDataUrl
    ? `<img src="${input.signatureDataUrl}" alt="Podpis klienta" style="display:block;max-width:280px;max-height:110px;margin-bottom:6px"/>`
    : `<div style="height:72px"></div>`;

  return `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Potwierdzenie oglądania · ${e(String(input.offerId))}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  body { margin:0; background:#e8e8ea; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; color:#171717; }
  .sheet { max-width:720px; margin:24px auto; background:#fff; box-shadow:0 8px 28px rgba(0,0,0,.08); }
  .brand { background:#000; padding:18px 28px; text-align:center; }
  .brand img { height:36px; width:auto; display:inline-block; }
  .brand-sub { color:rgba(255,255,255,.72); font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; margin-top:8px; }
  .inner { padding:28px 32px 36px; }
  h1 { margin:0 0 18px; text-align:center; font-size:18px; letter-spacing:.08em; font-weight:900; }
  .rule { height:1px; background:#e5e5ea; margin:16px 0; }
  .label { font-size:10px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:#8e8e93; margin:0 0 8px; }
  .block { margin-bottom:4px; }
  .block p { margin:3px 0; font-size:14px; line-height:1.45; }
  .title { font-weight:800; font-size:15px; }
  .oath { font-size:13.5px; line-height:1.55; color:#333; }
  .sign-row { display:flex; gap:24px; align-items:flex-end; margin-top:28px; }
  .sign-col { flex:1; }
  .sign-line { border-bottom:1px solid #c7c7cc; min-height:90px; }
  .sign-cap { font-size:11px; color:#8e8e93; margin-top:6px; }
  .stamp { font-size:12px; color:#555; text-align:right; padding-bottom:8px; }
  .foot { margin-top:28px; padding-top:12px; border-top:1px solid #e5e5ea; display:flex; justify-content:space-between; gap:12px; font-size:10px; color:#8e8e93; }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <img src="${e(input.logoAbsoluteUrl)}" alt="EstateOS"/>
      ${input.agencyName ? `<div class="brand-sub">${e(input.agencyName)}</div>` : ''}
    </div>
    <div class="inner">
      <h1>POTWIERDZENIE OGLĄDANIA NIERUCHOMOŚCI</h1>
      <div class="rule"></div>

      <div class="block">
        <p class="label">Nieruchomość</p>
        <p class="title">${e(input.offerTitle)}</p>
        <p>${e(input.offerAddress)}</p>
        <p>ID oferty #${e(String(input.offerId))}</p>
        ${priceRow}
        <p>Data oglądania: <strong>${e(input.viewingAtLabel)}</strong></p>
      </div>
      <div class="rule"></div>

      <div class="block">
        <p class="label">Klient</p>
        <p class="title">${e(input.clientName)}</p>
        ${input.clientPhone ? `<p>Tel. ${e(input.clientPhone)}</p>` : ''}
        ${input.clientEmail ? `<p>E-mail: ${e(input.clientEmail)}</p>` : ''}
        ${peselRow}
      </div>
      <div class="rule"></div>

      <div class="block">
        <p class="label">Agent</p>
        <p>${e(input.agentName)}${input.agencyName ? ` · ${e(input.agencyName)}` : ''}${input.agentPhone ? ` · tel. ${e(input.agentPhone)}` : ''}</p>
      </div>
      <div class="rule"></div>

      <div class="block">
        <p class="label">Oświadczenie</p>
        <p class="oath">Ja, niżej podpisany/a, potwierdzam, że w dniu ${e(input.viewingDatePart)} o godz. ${e(input.viewingTimePart)} obejrzałem/am wskazaną nieruchomość w obecności agenta ${e(input.agentName)}. Niniejszy dokument służy wyłącznie jako potwierdzenie obecności na oglądaniu i nie stanowi umowy pośrednictwa, umowy przedwstępnej ani oferty kupna.</p>
      </div>

      <div class="sign-row">
        <div class="sign-col">
          <div class="sign-line">${sig}</div>
          <div class="sign-cap">Podpis klienta</div>
        </div>
        <div class="sign-col stamp">Podpisano elektronicznie:<br/><strong>${e(input.signedAtLabel)}</strong></div>
      </div>

      <div class="foot">
        <span>${e(input.documentId)}</span>
        <span>Wygenerowano w EstateOS</span>
        <span>RODO: dane przetwarzane w celu obsługi oglądania przez ${e(input.agencyName || 'biuro')}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildAttendanceClientEmailHtml(params: {
  firstName: string;
  address: string;
  whenLabel: string;
  agentName: string;
  agencyName: string;
  agentPhone: string | null;
}): string {
  const e = escapeAcquisitionHtml;
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;max-width:560px">
    <p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#059669;font-weight:800">${e(params.agencyName)}</p>
    <h2 style="margin:8px 0 12px">Potwierdzenie oglądania</h2>
    <p>Dzień dobry ${e(params.firstName)},</p>
    <p>w załączeniu przesyłamy kopię potwierdzenia oglądania nieruchomości:</p>
    <p>📍 ${e(params.address)}<br/>📅 ${e(params.whenLabel)}<br/>👤 Agent: ${e(params.agentName)} (${e(params.agencyName)})</p>
    <p style="font-size:13px;color:#555">Dokument jest wyłącznie potwierdzeniem obecności na oglądaniu — nie stanowi umowy pośrednictwa ani oferty kupna.</p>
    <p>Pozdrawiamy,<br/>${e(params.agencyName)}${params.agentPhone ? `<br/>${e(params.agentPhone)}` : ''}</p>
  </div>`;
}

export function formatMoneyPln(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return `${Math.round(Number(value)).toLocaleString('pl-PL')} zł`;
}
