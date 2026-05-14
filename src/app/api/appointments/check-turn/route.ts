import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      isMyTurn: false,
      error: 'Deprecated endpoint. Użyj /api/deals/[id] + canonical DEAL_EVENT state.',
    },
    { status: 410 }
  );
}
