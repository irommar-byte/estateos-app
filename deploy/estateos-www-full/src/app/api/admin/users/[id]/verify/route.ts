import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
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
  if (raw === 'verify' || raw === 'confirm' || raw === 'potwierdz') return 'verify';
  if (raw === 'unverify' || raw === 'revoke' || raw === 'cofnij') return 'unverify';
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID użytkownika' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const channel = parseChannel(body?.channel ?? body?.type);
    const action = parseAction(body?.action);

    if (!channel || !action) {
      return NextResponse.json(
        { success: false, error: 'Wymagane: channel (email|phone) i action (verify|unverify)' },
        { status: 400 },
      );
    }

    const result = await applyAdminUserVerification({
      userId,
      channel,
      action,
      adminId: admin.id,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, verification: result.verification });
  } catch (error) {
    console.error('[ADMIN USER VERIFY]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}
