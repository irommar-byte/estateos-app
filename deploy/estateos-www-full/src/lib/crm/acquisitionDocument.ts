import { publicAssetUrl, type AcquisitionFormData } from "@/lib/acquisitionWorkflow";
import { buildPortalDocumentUrl, buildPortalUrl } from "@/lib/agencyClientNotify";

export function escapeAcquisitionHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAcquisitionDocumentHtml(params: {
  agreement: string;
  signatureData?: string | null;
  signerName?: string | null;
  signedAt?: Date | string | null;
  hash?: string | null;
  paperContracts?: AcquisitionFormData["paperContracts"];
}) {
  const signedAtLabel =
    params.signedAt instanceof Date
      ? params.signedAt.toLocaleString("pl-PL")
      : params.signedAt
        ? new Date(params.signedAt).toLocaleString("pl-PL")
        : "";
  const papers = (params.paperContracts || [])
    .map((file) => {
      const href = publicAssetUrl(file.url);
      if (!href) return "";
      return `<p><a href="${escapeAcquisitionHtml(href)}">${escapeAcquisitionHtml(file.name)}</a></p>`;
    })
    .filter(Boolean)
    .join("");

  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Umowa i karta pozyskania · EstateOS™</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:820px;margin:40px auto;padding:0 24px 64px;color:#171717;line-height:1.55;background:#f6f6f8}article{background:#fff;border:1px solid #e7e7ea;border-radius:20px;padding:32px}pre{white-space:pre-wrap;font:inherit;margin:0}.sign{margin-top:36px;padding-top:24px;border-top:1px solid #ddd}.sign img{display:block;max-width:360px;max-height:150px;border:1px solid #ddd;border-radius:12px}.audit{font-size:12px;color:#666;word-break:break-all}a{color:#0f766e}</style>
</head><body><article><pre>${escapeAcquisitionHtml(params.agreement)}</pre>
${
  params.signatureData || params.signerName
    ? `<section class="sign"><h2>Podpis klienta</h2>
${params.signatureData ? `<img src="${params.signatureData}" alt="Podpis klienta">` : ""}
<p><strong>${escapeAcquisitionHtml(params.signerName || "—")}</strong><br>${escapeAcquisitionHtml(signedAtLabel || "—")}</p>
<p class="audit">SHA-256: ${escapeAcquisitionHtml(params.hash || "—")}</p></section>`
    : ""
}
${papers ? `<section class="sign"><h2>Skan umowy</h2>${papers}</section>` : ""}
</article></body></html>`;
}

export function buildAcquisitionClientEmailHtml(params: {
  firstName: string;
  title: string;
  intro: string;
  portalUrl: string;
  documentUrl: string;
  documentLabel: string;
  extraHtml?: string;
}): string {
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;max-width:560px">
    <h2 style="margin:0 0 12px">${escapeAcquisitionHtml(params.title)}</h2>
    <p>Dzień dobry ${escapeAcquisitionHtml(params.firstName)},</p>
    <p>${escapeAcquisitionHtml(params.intro)}</p>
    <p><a href="${escapeAcquisitionHtml(params.documentUrl)}" style="display:inline-block;background:#10b981;color:#07130e;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">${escapeAcquisitionHtml(params.documentLabel)}</a></p>
    <p><a href="${escapeAcquisitionHtml(params.portalUrl)}" style="display:inline-block;background:#ecfdf3;color:#065f46;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Otwórz panel klienta</a></p>
    ${params.extraHtml || ""}
    <p style="font-size:12px;color:#6b7280;margin-top:20px">Dokument otwiera się w przeglądarce pod bezpiecznym adresem estateos.pl — nie jako plik z poczty.</p>
  </div>`;
}

export function acquisitionClientLinks(portalToken: string | null | undefined) {
  const token = String(portalToken || "").trim();
  if (!token) {
    return { portalUrl: "https://estateos.pl", documentUrl: "https://estateos.pl" };
  }
  return {
    portalUrl: buildPortalUrl(token),
    documentUrl: buildPortalDocumentUrl(token),
  };
}
