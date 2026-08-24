import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyUserId } from "@/lib/agencyClientAuth";
import {
  buildAcquisitionAgreementText,
  clampAcquisitionStep,
  createDefaultAcquisitionForm,
  isAcquisitionLocked,
  normalizeAcquisitionForm,
  publicAssetUrl,
  type AcquisitionFormData,
} from "@/lib/acquisitionWorkflow";
import { sendTransactionalEmail } from "@/lib/email/transactional";
import { resolveSellerPersonName } from "@/lib/sellerDisplay";
import { createOfferFromAcquisitionRecord } from "@/lib/crm/acquisitionOffer";
import { parseSellerPropertyType } from "@/lib/crm/sellerProperty";
import { sendNotification } from "@/lib/core/notification.core";
import { crmAgentPushData } from "@/lib/crm/agentPush";
import {
  acquisitionClientLinks,
  buildAcquisitionClientEmailHtml,
} from "@/lib/crm/acquisitionDocument";

type RouteCtx = { params: Promise<{ id: string }> };

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function portalLinks(client: { portalToken?: string | null }) {
  return acquisitionClientLinks(client.portalToken);
}

function shapeAcquisition(record: any, fallbackForm: AcquisitionFormData) {
  if (!record) return null;
  return {
    id: record.id,
    clientId: record.clientId,
    status: record.status,
    currentStep: isAcquisitionLocked(record) ? 7 : record.currentStep,
    formData: normalizeAcquisitionForm(record.formData, fallbackForm),
    agreementSnapshot: record.agreementSnapshot,
    approvedTemplateConfirmed: Boolean(record.approvedTemplateConfirmed),
    clientAcknowledgedAt: record.clientAcknowledgedAt?.toISOString() ?? null,
    clientAcknowledgementName: record.clientAcknowledgementName,
    signedAt: record.signedAt?.toISOString() ?? null,
    signerName: record.signerName,
    signerEmail: record.signerEmail,
    documentHash: record.documentHash,
    copyEmailSentAt: record.copyEmailSentAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function loadContext(clientId: number, agencyUserId: number) {
  return prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: "ACTIVE", type: "SELLER" },
    include: {
      acquisition: true,
      agencyUser: {
        select: { name: true, companyName: true, email: true, phone: true },
      },
    },
  });
}

function buildSnapshot(client: Awaited<ReturnType<typeof loadContext>>, form: AcquisitionFormData, reference: string) {
  if (!client) throw new Error("Nie znaleziono klienta.");
  const agentName =
    resolveSellerPersonName(client.agencyUser) ||
    client.agencyUser.name ||
    "Agent";
  return buildAcquisitionAgreementText({
    reference,
    createdAt: new Date().toLocaleString("pl-PL"),
    agencyName: client.agencyUser.companyName?.trim() || "EstateOS",
    agentName,
    agentEmail: client.agencyUser.email,
    agentPhone: client.agencyUser.phone,
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    clientEmail: client.email,
    clientPhone: client.phone,
    clientPesel: client.pesel,
    form,
  });
}

async function syncMeetingActivity(params: {
  clientId: number;
  agencyUserId: number;
  clientName: string;
  form: AcquisitionFormData;
}) {
  const rawStartsAt = params.form.meeting.startsAt;
  if (!rawStartsAt) return;
  const startsAt = new Date(rawStartsAt);
  if (Number.isNaN(startsAt.getTime())) return;
  const existing = await prisma.agencyClientActivity.findFirst({
    where: { clientId: params.clientId, agencyUserId: params.agencyUserId, kind: "ACQUISITION_MEETING" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const metadata = {
    startsAt: startsAt.toISOString(),
    location: params.form.meeting.location || null,
    notes: params.form.meeting.reasonForSale || null,
    source: "acquisition_workflow",
  };
  const title = `Pozyskanie · ${params.clientName}`;
  const activityBody =
    [params.form.meeting.location, params.form.meeting.clientGoal].filter(Boolean).join(" · ") ||
    "Spotkanie pozyskania";
  if (existing) {
    await prisma.agencyClientActivity.update({
      where: { id: existing.id },
      data: { title, body: activityBody, metadata },
    });
  } else {
    await prisma.agencyClientActivity.create({
      data: {
        clientId: params.clientId,
        agencyUserId: params.agencyUserId,
        kind: "ACQUISITION_MEETING",
        title,
        body: activityBody,
        metadata,
      },
    });
  }
}

export async function GET(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
  const clientId = Number((await ctx.params).id);
  const client = await loadContext(clientId, agencyUserId);
  if (!client) return NextResponse.json({ error: "Nie znaleziono klienta sprzedającego." }, { status: 404 });
  const fallbackForm = createDefaultAcquisitionForm(client);
  const meetingAct = await prisma.agencyClientActivity.findFirst({
    where: { clientId, agencyUserId, kind: "ACQUISITION_MEETING" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, body: true },
  });
  const meta = (meetingAct?.metadata || {}) as Record<string, unknown>;
  if (typeof meta.startsAt === "string" && !fallbackForm.meeting.startsAt) {
    const d = new Date(meta.startsAt);
    if (!Number.isNaN(d.getTime())) {
      const pad = (n: number) => String(n).padStart(2, "0");
      fallbackForm.meeting.startsAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  }
  if (typeof meta.location === "string" && meta.location && !fallbackForm.meeting.location) {
    fallbackForm.meeting.location = meta.location;
  }
  const acquisition = shapeAcquisition(client.acquisition, fallbackForm);
  if (acquisition?.formData?.meeting && !String(acquisition.formData.meeting.startsAt || "").trim() && fallbackForm.meeting.startsAt) {
    acquisition.formData.meeting.startsAt = fallbackForm.meeting.startsAt;
    if (fallbackForm.meeting.location) acquisition.formData.meeting.location = fallbackForm.meeting.location;
  }
  return NextResponse.json({
    success: true,
    acquisition,
    defaultForm: fallbackForm,
    portalUrl: client.portalToken ? `/klient/${client.portalToken}` : null,
    documentUrl: client.portalToken ? `/klient/${client.portalToken}/dokument` : null,
  });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
  const clientId = Number((await ctx.params).id);
  const client = await loadContext(clientId, agencyUserId);
  if (!client) return NextResponse.json({ error: "Nie znaleziono klienta sprzedającego." }, { status: 404 });
  if (isAcquisitionLocked(client.acquisition)) {
    return NextResponse.json({ error: "Podpisany dokument jest zablokowany przed zmianami." }, { status: 409 });
  }

  const body = await req.json();
  const formData = normalizeAcquisitionForm(
    body.formData || client.acquisition?.formData,
    createDefaultAcquisitionForm(client),
  );
  const currentStep = clampAcquisitionStep(body.currentStep || client.acquisition?.currentStep || 1);
  const status = ["PREPARATION", "IN_MEETING", "TERMS_READY", "CANCELLED"].includes(String(body.status))
    ? String(body.status)
    : client.acquisition?.status || "PREPARATION";

  const record = await prisma.agencyClientAcquisition.upsert({
    where: { clientId },
    update: {
      formData,
      currentStep,
      status,
      approvedTemplateConfirmed:
        body.approvedTemplateConfirmed === undefined
          ? undefined
          : Boolean(body.approvedTemplateConfirmed),
      ...(body.invalidateAgreement === true ? { agreementSnapshot: null, status: "IN_MEETING" } : {}),
    },
    create: {
      clientId,
      agencyUserId,
      formData,
      currentStep,
      status,
      approvedTemplateConfirmed: Boolean(body.approvedTemplateConfirmed),
    },
  });
  await syncMeetingActivity({
    clientId,
    agencyUserId,
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    form: formData,
  });
  const sellerCity = String(formData.property.city || "").trim();
  const sellerDistrict = String(formData.property.district || "").trim();
  const sellerArea = Number(String(formData.property.area || "").replace(/\s/g, "").replace(",", "."));
  const sellerRooms = Number(formData.property.rooms);
  const sellerPrice = Number(String(formData.strategy.expectedPrice || "").replace(/\s/g, "").replace(",", "."));
  await prisma.agencyClient.update({
    where: { id: clientId },
    data: {
      ...(sellerCity ? { sellerCity } : {}),
      ...(sellerDistrict ? { sellerDistrict } : {}),
      ...(Number.isFinite(sellerArea) && sellerArea > 0 ? { sellerArea } : {}),
      ...(Number.isFinite(sellerRooms) && sellerRooms > 0 ? { sellerRooms: Math.round(sellerRooms) } : {}),
      ...(Number.isFinite(sellerPrice) && sellerPrice > 0 ? { sellerPrice } : {}),
      sellerPropertyType: parseSellerPropertyType(formData.property.propertyType),
    },
  }).catch(() => {});

  return NextResponse.json({ success: true, acquisition: shapeAcquisition(record, formData) });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
  const clientId = Number((await ctx.params).id);
  let client = await loadContext(clientId, agencyUserId);
  if (!client) return NextResponse.json({ error: "Nie znaleziono klienta sprzedającego." }, { status: 404 });
  const body = await req.json();
  const action = String(body.action || "");
  if (isAcquisitionLocked(client.acquisition)) {
    return NextResponse.json({ error: "Pozysk jest zamknięty. Umowa jest tylko do podglądu." }, { status: 409 });
  }
  const form = normalizeAcquisitionForm(
    body.formData || client.acquisition?.formData,
    createDefaultAcquisitionForm(client),
  );

  const base = await prisma.agencyClientAcquisition.upsert({
    where: { clientId },
    update: { formData: form, currentStep: Math.min(6, Math.max(1, Number(body.currentStep || 6))) },
    create: { clientId, agencyUserId, formData: form, currentStep: 6, status: "IN_MEETING" },
  });
  client = await loadContext(clientId, agencyUserId);
  if (!client) return NextResponse.json({ error: "Nie znaleziono klienta." }, { status: 404 });

  if (action === "prepare_terms" || action === "send_preview") {
    const agreement = buildSnapshot(client, form, `EOS-POZ-${clientId}-${base.id}`);
    const updated = await prisma.agencyClientAcquisition.update({
      where: { id: base.id },
      data: {
        formData: form,
        agreementSnapshot: agreement,
        approvedTemplateConfirmed: Boolean(body.approvedTemplateConfirmed),
        status: "TERMS_READY",
        currentStep: 6,
      },
    });

    let emailSent = false;
    if (action === "send_preview" && client.email) {
      const links = portalLinks(client);
      emailSent = await sendTransactionalEmail({
        to: client.email,
        subject: `Warunki współpracy do zapoznania · ${client.agencyUser.companyName || "EstateOS"}`,
        html: buildAcquisitionClientEmailHtml({
          firstName: client.firstName,
          title: "Przygotowanie do spotkania",
          intro:
            "Agent przygotował umowę i warunki współpracy. Otwórz dokument w przeglądarce — szczegóły i listę rzeczy na spotkanie znajdziesz też w panelu klienta.",
          portalUrl: links.portalUrl,
          documentUrl: links.documentUrl,
          documentLabel: "Otwórz warunki współpracy",
        }),
      });
    }
    return NextResponse.json({
      success: true,
      emailSent,
      documentUrl: client.portalToken ? `/klient/${client.portalToken}/dokument` : null,
      acquisition: shapeAcquisition(updated, form),
    });
  }

  if (action === "sign") {
    if (client.acquisition?.status === "SIGNED") {
      return NextResponse.json({ error: "Dokument został już podpisany." }, { status: 409 });
    }
    const signatureData = String(body.signatureData || "");
    if (!/^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(signatureData) || signatureData.length > 400_000) {
      return NextResponse.json({ error: "Podpis jest nieprawidłowy lub zbyt duży." }, { status: 400 });
    }
    const signerName = String(body.signerName || "").trim();
    const signerEmail = String(body.signerEmail || client.email || "").trim().toLowerCase();
    if (!signerName || !signerEmail.includes("@")) {
      return NextResponse.json({ error: "Podaj imię, nazwisko i prawidłowy e-mail podpisującego." }, { status: 400 });
    }
    if (body.approvedTemplateConfirmed !== true && !client.acquisition?.approvedTemplateConfirmed) {
      return NextResponse.json({ error: "Agent musi potwierdzić użycie zatwierdzonego wzoru firmy." }, { status: 400 });
    }

    const agreement =
      client.acquisition?.agreementSnapshot ||
      buildSnapshot(client, form, `EOS-POZ-${clientId}-${base.id}`);
    const signedAt = new Date();
    const documentHash = createHash("sha256")
      .update(`${agreement}\n${signatureData}\n${signerName}\n${signedAt.toISOString()}`)
      .digest("hex");
    const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    const signerIpHash = forwardedIp
      ? createHash("sha256")
          .update(`${forwardedIp}:${process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "estateos"}`)
          .digest("hex")
      : null;

    const updated = await prisma.agencyClientAcquisition.update({
      where: { id: base.id },
      data: {
        formData: form,
        agreementSnapshot: agreement,
        approvedTemplateConfirmed: true,
        signatureSvg: signatureData,
        signerName,
        signerEmail,
        signedAt,
        documentHash,
        signerIpHash,
        signerUserAgent: String(req.headers.get("user-agent") || "").slice(0, 512) || null,
        status: "SIGNED",
        currentStep: 7,
      },
    });

    const links = portalLinks(client);
    const paperLinks = (form.paperContracts || [])
      .map((file) => {
        const href = publicAssetUrl(file.url);
        if (!href) return "";
        return `<p><a href="${href}" style="color:#0f766e">${escapeHtml(file.name)}</a></p>`;
      })
      .filter(Boolean)
      .join("");
    const emailSent = await sendTransactionalEmail({
      to: signerEmail,
      subject: `Podpisana umowa i karta nieruchomości · ${client.agencyUser.companyName || "EstateOS"}`,
      html: buildAcquisitionClientEmailHtml({
        firstName: client.firstName,
        title: "Dokument został podpisany",
        intro: `Umowa została utrwalona ${signedAt.toLocaleString("pl-PL")}. Otwórz ją w przeglądarce — to publiczny link EstateOS, nie załącznik z poczty.`,
        portalUrl: links.portalUrl,
        documentUrl: links.documentUrl,
        documentLabel: "Otwórz podpisaną umowę",
        extraHtml: `${paperLinks}<p style="font-size:12px;color:#6b7280;word-break:break-all">SHA-256: ${escapeHtml(documentHash)}</p>`,
      }),
    });
    if (emailSent) {
      await prisma.agencyClientAcquisition.update({
        where: { id: base.id },
        data: { copyEmailSentAt: new Date() },
      });
    }
    await prisma.agencyClientActivity.create({
      data: {
        clientId,
        agencyUserId,
        kind: "ACQUISITION_SIGNED",
        title: "Podpisano warunki współpracy",
        body: `Podpisujący: ${signerName}. Kopia e-mail: ${emailSent ? "wysłana" : "niewysłana"}.`,
        metadata: { acquisitionId: base.id, documentHash, signedAt: signedAt.toISOString(), emailSent },
      },
    });

    let offerId: number | null = null;
    let offerError: string | null = null;
    const offerResult = await createOfferFromAcquisitionRecord({ agencyUserId, clientId });
    if (offerResult.ok) {
      offerId = offerResult.offerId;
    } else {
      offerError = offerResult.error;
    }

    await sendNotification({
      userId: agencyUserId,
      type: "CRM_EVENT",
      title: offerId ? "Umowa podpisana — szkic oferty" : "Umowa podpisana",
      body: offerId
        ? `${client.firstName} ${client.lastName} · szkic #${offerId} (niepubliczny)`
        : `${client.firstName} ${client.lastName}. ${offerError || "Utwórz szkic oferty ręcznie z karty."}`,
      data: crmAgentPushData(clientId, { notificationType: "crm_client_signed" }),
    }).catch(() => {});

    const finalRecord = await prisma.agencyClientAcquisition.findUnique({ where: { id: base.id } });
    return NextResponse.json({
      success: true,
      emailSent,
      offerId,
      offerError,
      documentUrl: client.portalToken ? `/klient/${client.portalToken}/dokument` : null,
      acquisition: shapeAcquisition(finalRecord, form),
    });
  }

  return NextResponse.json({ error: "Nieznana akcja." }, { status: 400 });
}
