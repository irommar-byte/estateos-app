import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('estateos_session')?.value;
        const expectedChallenge = cookieStore.get('passkey_challenge')?.value;

        if (!sessionCookie || !expectedChallenge) {
            return NextResponse.json({ error: "Sesja wygasła" }, { status: 400 });
        }

        const session = decryptSession(sessionCookie);
        const user = await prisma.user.findUnique({ where: { email: session.email }});
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        const verification = await verifyRegistrationResponse({
            response: body,
            expectedChallenge,
            expectedOrigin: process.env.NODE_ENV === 'production' ? ['https://estateos.pl','https://www.estateos.pl'] : 'http://localhost:3000',
            expectedRPID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

            // Zapisujemy klucz kryptograficzny klienta w naszej bazie
            await prisma.authenticator.create({
                data: {
                    credentialID: credential.id,
                    credentialPublicKey: Buffer.from(credential.publicKey).toString('base64url'),
                    counter: credential.counter,
                    credentialDeviceType,
                    credentialBackedUp,
                    userId: user.id,
                    providerAccountId: 'passkey',
                },
            });

            // Usuwamy zużyte wyzwanie
            cookieStore.delete('passkey_challenge');

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Weryfikacja nie powiodła się" }, { status: 400 });
    } catch (error) {
        console.error("Błąd weryfikacji Passkey:", error);
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}
