import { NextResponse } from 'next/server';
import { loadAgentPublicProfile } from '@/lib/loadAgentPublicProfile';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });
    }

    const profile = await loadAgentPublicProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('profil GET', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
