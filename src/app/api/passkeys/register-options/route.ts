import { generateRegistrationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('estateos_session')?.value;
        if (!sessionCookie) return NextResponse.json({ error: "Brak sesji" }, { status: 401 });
        
        const session = decryptSession(sessionCookie);
        if (!session?.email) return NextResponse.json({ error: "Błąd sesji" }, { status: 401 });

        const user = await prisma.user.findUnique({ where: { email: session.email }});
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });

        // Parametry dla Face ID / Touch ID
        const options = await generateRegistrationOptions({
            rpName: 'EstateOS',
            rpID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            userID: new Uint8Array(Buffer.from(user.id.toString())),
            userName: user.email,
            attestationType: 'none',
            excludeCredentials: authenticators.map(auth => ({
                id: auth.credentialID,
                type: 'public-key',
            })),
            authenticatorSelection: {
                residentKey: 'required',
                userVerification: 'preferred',
            },
        });

        // Zapisujemy wyzwanie w ciasteczku (żyje tylko 5 minut), żeby potem je zweryfikować
        cookieStore.set('passkey_challenge', options.challenge, { 
            httpOnly: true, 
            maxAge: 60 * 5, 
            path: '/' 
        });

        return NextResponse.json(options);
    } catch (error) {
        console.error("Błąd generowania Passkey:", error);
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}
