import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgencyUserId } from "@/lib/agencyClientAuth";
import { getWebFormData } from "@/lib/requestFormData";
import {
  createDefaultAcquisitionForm,
  normalizeAcquisitionForm,
  type AcquisitionFormData,
} from "@/lib/acquisitionWorkflow";
import { saveAcquisitionPaperFile } from "@/lib/upload/acquisitionDocumentUpload";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: "Dostęp tylko dla agencji i agentów." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const clientId = Number(id);
  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId, status: "ACTIVE", type: "SELLER" },
    include: { acquisition: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Nie znaleziono klienta." }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ error: "Błąd formularza." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "Brak pliku." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await saveAcquisitionPaperFile({
    clientId,
    buffer,
    mimeTypeDeclared: String(file.type || ""),
    originalFileName: String((file as File & { name?: string }).name || "umowa"),
  });
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status });
  }

  const purpose = String(formData.get("purpose") || "paper").trim().toLowerCase();
  if (purpose === "asset") {
    return NextResponse.json({
      success: true,
      file: { url: saved.url, name: saved.name, mimeType: saved.mimeType },
    });
  }
  const fallback = createDefaultAcquisitionForm(client);
  const current = normalizeAcquisitionForm(client.acquisition?.formData, fallback);
  const nextForm: AcquisitionFormData =
    purpose === "plan"
      ? {
          ...current,
          property: {
            ...current.property,
            planImages: [current.property.planImages, saved.url].filter(Boolean).join(","),
          },
        }
      : {
          ...current,
          paperContracts: [
            ...(current.paperContracts || []),
            { url: saved.url, name: saved.name, uploadedAt: new Date().toISOString() },
          ],
        };

  const acquisition = client.acquisition
    ? await prisma.agencyClientAcquisition.update({
        where: { id: client.acquisition.id },
        data: { formData: nextForm as object },
      })
    : await prisma.agencyClientAcquisition.create({
        data: {
          clientId,
          agencyUserId,
          formData: nextForm as object,
          status: "IN_MEETING",
          currentStep: 6,
        },
      });

  return NextResponse.json({
    success: true,
    file: { url: saved.url, name: saved.name, mimeType: saved.mimeType },
    formData: nextForm,
    acquisitionId: acquisition.id,
  });
}
