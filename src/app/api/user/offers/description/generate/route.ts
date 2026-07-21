export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import {
  generateListingDescriptionWithGpt,
  openAiErrorMessage,
  type ListingDescriptionDraftInput,
} from "@/lib/listingDescriptionAi";

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: "Generator opisów AI jest dostępny dla zalogowanych użytkowników. Zarejestruj się lub zaloguj.",
      },
      { status: 401 },
    );
  }

  let body: ListingDescriptionDraftInput;
  try {
    body = (await req.json()) as ListingDescriptionDraftInput;
  } catch {
    return NextResponse.json({ success: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const hasBasics =
    String(body.propertyType || "").trim() ||
    String(body.city || "").trim() ||
    parseNum(body.area) ||
    String(body.existingDescription || "").trim() ||
    String(body.userNotes || "").trim();

  if (!hasBasics) {
    return NextResponse.json(
      {
        success: false,
        error: "Uzupełnij typ, lokalizację lub parametry oferty przed generowaniem opisu.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateListingDescriptionWithGpt(body);
    return NextResponse.json({
      success: true,
      description: result.description,
      model: result.model,
      generatedBy: "gpt",
    });
  } catch (err) {
    console.warn("[listing-description-ai/web]", err);
    return NextResponse.json(
      { success: false, error: openAiErrorMessage(err) },
      { status: 502 },
    );
  }
}

function parseNum(raw: unknown): number | null {
  const n = Number(String(raw ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
