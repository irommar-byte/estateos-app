import { NextResponse } from "next/server";
import { sendTransactionalEmail, isEmailDeliveryEnabled } from "@/lib/email/transactional";

export const dynamic = "force-dynamic";

const CONTACT_TO = (process.env.CONTACT_EMAIL || "kontakt@estateos.pl").trim();

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const honeypot = String(body?.website || "").trim();
    if (honeypot) {
      return NextResponse.json({ success: true });
    }

    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const topic = String(body?.topic || "").trim();
    const message = String(body?.message || "").trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ error: "INVALID_NAME" }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "INVALID_EMAIL" }, { status: 400 });
    }
    if (!message || message.length < 10) {
      return NextResponse.json({ error: "INVALID_MESSAGE" }, { status: 400 });
    }

    const subject = `[EstateOS Kontakt] ${topic || "Wiadomość"} — ${name}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
        <h2 style="color:#059669;margin:0 0 16px">Nowa wiadomość z formularza kontaktowego</h2>
        <p><strong>Od:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
        <p><strong>Temat:</strong> ${escapeHtml(topic || "—")}</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</p>
      </div>
    `;

    if (!isEmailDeliveryEnabled()) {
      return NextResponse.json({
        success: false,
        fallbackMailto: true,
        mailto: `mailto:${CONTACT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
          `Od: ${name} <${email}>\n\n${message}`,
        )}`,
      });
    }

    const sent = await sendTransactionalEmail({
      to: CONTACT_TO,
      subject,
      html,
    });

    if (!sent) {
      return NextResponse.json({
        success: false,
        fallbackMailto: true,
        mailto: `mailto:${CONTACT_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
          `Od: ${name} <${email}>\n\n${message}`,
        )}`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CONTACT POST:", error);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
