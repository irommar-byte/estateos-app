import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const globalAny = global as any;
if (typeof globalAny.typingStore === 'undefined') {
  globalAny.typingStore = {};
}

export async function POST(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/typing/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealIdInt = parseInt(match[1]);
    
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    const decoded = jwt.decode(token as string) as any;
    const userId = decoded?.id || decoded?.userId;

    if (typeof globalAny.typingStore[dealIdInt] === 'undefined') {
      globalAny.typingStore[dealIdInt] = {};
    }
    globalAny.typingStore[dealIdInt][userId] = Date.now();

    fetch(`http://localhost:3000/api/deals/${dealIdInt}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: userId })
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
