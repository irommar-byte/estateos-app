import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createDefaultAcquisitionForm,
  normalizeAcquisitionForm,
  type AcquisitionFormData,
} from "@/lib/acquisitionWorkflow";
import { buildAcquisitionDocumentHtml } from "@/lib/crm/acquisitionDocument";

type RouteCtx = { params: Promise<{ token: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { token } = await ctx.params;
  const client = await prisma.agencyClient.findFirst({
    where: { portalToken: token, status: "ACTIVE" },
    include: { acquisition: true },
  });
  if (!client?.acquisition) {
    return new NextResponse(
      `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Dokument · EstateOS™</title></head><body style="font-family:-apple-system,sans-serif;padding:48px;color:#444"><p>Agent jeszcze nie przygotował warunków współpracy.</p></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } },
    );
  }

  const form = normalizeAcquisitionForm(
    client.acquisition.formData,
    createDefaultAcquisitionForm(client),
  ) as AcquisitionFormData;
  const html = buildAcquisitionDocumentHtml({
    agreement:
      client.acquisition.agreementSnapshot ||
      "Warunki współpracy są w przygotowaniu. Odśwież stronę za chwilę.",
    signatureData: client.acquisition.signatureSvg,
    signerName: client.acquisition.signerName,
    signedAt: client.acquisition.signedAt,
    hash: client.acquisition.documentHash,
    paperContracts: form.paperContracts,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
