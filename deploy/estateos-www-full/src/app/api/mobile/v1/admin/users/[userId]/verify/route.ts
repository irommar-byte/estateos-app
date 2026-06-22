import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import {
  applyAdminUserVerification,
  type AdminVerifyAction,
  type AdminVerifyChannel,
} from '@/lib/adminUserVerification';

function parseChannel(value: unknown): AdminVerifyChannel | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'email' || raw === 'e-mail' || raw === 'mail') return 'email';
  if (raw === 'phone' || raw === 'sms' || raw === 'telefon') return 'phone';
  return null;
}

function parseAction(value: unknown): AdminVerifyAction | null {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'verify' || raw === 'confirm') return 'verify';
  if (raw === 'unverify' || raw === 'revoke') return 'unverify';
  return null;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ userId: string }> },
) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

    const { userId: rawId } = await context.params;
    const userId = Number(rawId);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const channel = parseChannel(body?.channel ?? body?.type);
    const action = parseAction(body?.action);

    if (!channel || !action) {
      return NextResponse.json(
        { success: false, message: 'Wymagane: channel (email|phone) i action (verify|unverify)' },
        { status: 400 },
      );
    }

    const result = await applyAdminUserVerification({
      userId,
      channel,
      action,
      adminId: gate.adminId,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, message: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, verification: result.verification });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
