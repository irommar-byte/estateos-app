import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  return NextResponse.json(
    {
      success: false,
      error: 'Deprecated endpoint. Użyj /api/deals/init + /api/deals/[id]/actions.',
    },
    { status: 410 }
  );
}
