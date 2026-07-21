export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { resolveWebUserId } from "@/lib/webSessionAuth";
import {
  generateCarListingDescriptionWithGpt,
  openAiErrorMessage,
  type CarDescriptionDraftInput,
} from "@/lib/carListingDescriptionAi";

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: CarDescriptionDraftInput;
  try {
    body = (await req.json()) as CarDescriptionDraftInput;
  } catch {
    return NextResponse.json({ success: false, error: "Nieprawidłowy JSON." }, { status: 400 });
  }

  const hasBasics =
    String(body.make || "").trim() &&
    String(body.model || "").trim() &&
    String(body.city || "").trim() &&
    Number(String(body.pricePln ?? "").replace(/\s/g, "").replace(",", ".")) > 0;

  if (!hasBasics) {
    return NextResponse.json(
      {
        success: false,
        error: "Uzupełnij markę, model, miejscowość i cenę przed generowaniem opisu.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await generateCarListingDescriptionWithGpt(body);
    return NextResponse.json({
      success: true,
      description: result.description,
      model: result.model,
      generatedBy: "gpt",
    });
  } catch (err) {
    console.warn("[car-listing-description-ai/web]", err);
    return NextResponse.json({ success: false, error: openAiErrorMessage(err) }, { status: 502 });
  }
}
