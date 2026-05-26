import { NextResponse } from 'next/server';

/** Legacy endpoint — nie używać. Negocjacje ceny tylko przez Deal Room (`/api/deals/...`). */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Ten endpoint jest wyłączony. Akceptuj cenę w Deal Room (Komunikacja → pokój negocjacji).',
    },
    { status: 410 }
  );
}
