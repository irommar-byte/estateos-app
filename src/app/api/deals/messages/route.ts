import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  return NextResponse.json(
    {
      success: false,
      error: 'Deprecated endpoint. Użyj /api/deals/[id]/messages (autoryzowany endpoint).',
    },
    { status: 410 }
  );
}

export async function POST(req: Request) {
  return NextResponse.json(
    {
      success: false,
      error: 'Deprecated endpoint. Użyj /api/deals/[id]/messages (autoryzowany endpoint).',
    },
    { status: 410 }
  );
}
