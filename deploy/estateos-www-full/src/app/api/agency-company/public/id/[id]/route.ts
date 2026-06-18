import { NextResponse } from 'next/server';
import { getCompanyPublicById } from '@/lib/agencyCompany';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const payload = await getCompanyPublicById(Number(id));
    if (!payload) {
      return NextResponse.json({ success: false, message: 'Nie znaleziono biura.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...payload });
  } catch (e) {
    console.error('agency-company/public/id', e);
    return NextResponse.json({ success: false, message: 'Błąd serwera.' }, { status: 500 });
  }
}
