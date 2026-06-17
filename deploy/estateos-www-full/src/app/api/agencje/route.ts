import { NextResponse } from 'next/server';
import { listAgenciesWithStats } from '@/lib/offerAgencyManagement';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const agencies = await listAgenciesWithStats();
    return NextResponse.json({ success: true, agencies });
  } catch {
    return NextResponse.json({ success: true, agencies: [] });
  }
}
