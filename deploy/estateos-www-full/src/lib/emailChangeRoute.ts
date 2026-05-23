import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authorizeMobile } from '@/lib/mobileAuth';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp } from '@/lib/observability';
import { requestEmailChange, confirmEmailChange } from '@/lib/emailChange';
import { MOBILE_USER_SELECT, shapeMobileUser } from '@/lib/mobileUserShape';

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pickEmail(body: Record<string, unknown>): unknown {
  return body.newEmail ?? body.email ?? body.address;
}

function pickCode(body: Record<string, unknown>): unknown {
  return body.code ?? body.otp ?? body.token;
}

function pickAction(body: Record<string, unknown>): string {
  return String(body.action ?? '').trim().toLowerCase();
}

function err(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function handleEmailChangeRequest(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`mobile-email-change-req:ip:${ip}`, 20, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;

  const rlUser = checkRateLimit(`mobile-email-change-req:user:${auth.userId}`, 5, 60 * 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  const body = await readBody(req);
  const result = await requestEmailChange(auth.userId, pickEmail(body));
  if (!result.ok) return err(result.status, result.error);
  return NextResponse.json({ success: true, ...(result.data || {}) }, { status: result.status || 200 });
}

export async function handleEmailChangeConfirm(req: Request) {
  const ip = getClientIp(req);
  const rlIp = checkRateLimit(`mobile-email-change-confirm:ip:${ip}`, 40, 60 * 60_000);
  if (!rlIp.allowed) return rateLimitResponse(rlIp.retryAfterSeconds);

  const auth = await authorizeMobile(req);
  if (!auth.ok) return auth.response;

  const rlUser = checkRateLimit(`mobile-email-change-confirm:user:${auth.userId}`, 10, 60 * 60_000);
  if (!rlUser.allowed) return rateLimitResponse(rlUser.retryAfterSeconds);

  const body = await readBody(req);
  const result = await confirmEmailChange(auth.userId, pickEmail(body), pickCode(body));
  if (!result.ok) return err(result.status, result.error);

  const updated = await prisma.user.findUnique({ where: { id: auth.userId }, select: MOBILE_USER_SELECT });
  return NextResponse.json(
    { success: true, user: updated ? shapeMobileUser(updated) : null },
    { status: 200 }
  );
}

/**
 * Łączony endpoint: rozróżnia request / confirm po polu `action` lub obecności `code`.
 */
export async function handleEmailChangeUnified(req: Request) {
  const body = await readBody(req);
  const action = pickAction(body);
  const hasCode = Boolean(pickCode(body));

  // Odtwarzamy request z body (handlery same ponownie odczytają body).
  const reqClone = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: JSON.stringify(body),
  });

  if (action === 'confirm' || (!action && hasCode)) {
    return handleEmailChangeConfirm(reqClone);
  }
  if (action === 'request' || (!action && !hasCode)) {
    return handleEmailChangeRequest(reqClone);
  }
  return err(400, 'Nieprawidłowa akcja');
}
