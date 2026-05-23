export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    categories: [
      { id: 'SPAM', label: 'Spam lub reklama' },
      { id: 'SCAM', label: 'Oszustwo lub próba wyłudzenia' },
      { id: 'HARASSMENT', label: 'Nękanie lub obraźliwe treści' },
      { id: 'ILLEGAL_CONTENT', label: 'Treści niezgodne z prawem' },
      { id: 'MISLEADING_OFFER', label: 'Nieprawdziwa lub myląca oferta' },
      { id: 'OTHER', label: 'Inny powód' },
    ],
  });
}
