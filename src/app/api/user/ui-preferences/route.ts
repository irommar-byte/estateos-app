import { NextResponse } from 'next/server';
import { resolveWebUserId } from '@/lib/webSessionAuth';
import { getUiPreference, isUiPreferenceKey, setUiPreference } from '@/lib/uiPreferences';

/** Ustawienia interfejsu zalogowanego użytkownika (np. pasek CRM). */
export async function GET(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: 'Brak sesji.' }, { status: 401 });
  const key = new URL(req.url).searchParams.get('key');
  if (!isUiPreferenceKey(key)) return NextResponse.json({ success: false, error: 'Nieznane ustawienie.' }, { status: 400 });
  return NextResponse.json({ success: true, value: await getUiPreference(userId, key) });
}

export async function POST(req: Request) {
  const userId = await resolveWebUserId(req);
  if (!userId) return NextResponse.json({ success: false, error: 'Brak sesji.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { key?: unknown; value?: unknown };
  if (!isUiPreferenceKey(body.key)) return NextResponse.json({ success: false, error: 'Nieznane ustawienie.' }, { status: 400 });
  try {
    await setUiPreference(userId, body.key, body.value);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Nie udało się zapisać.' }, { status: 400 });
  }
}
