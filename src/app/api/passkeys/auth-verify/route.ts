import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const cookieStore = await cookies();
        const expectedChallenge = cookieStore.get('passkey_auth_challenge')?.value;

        if (!expectedChallenge) return NextResponse.json({ error: "Sesja wygasła" }, { status: 400 });

        const authenticator = await prisma.authenticator.findUnique({ where: { credentialID: body.rawId } });
        if (!authenticator) return NextResponse.json({ error: "Nieznany klucz biometryczny" }, { status: 404 });

        const user = await prisma.user.findUnique({ where: { id: authenticator.userId } });
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        
        const origin = req.headers.get('origin') || 'https://estateos.pl';
        console.log('🔍 [DEBUG] Próba logowania FaceID:');
        console.log('   -> Origin z żądania:', origin);
console.log("DB credential:", authenticator?.credentialID);
console.log("REQ credential:", body.rawId);
console.log("RAW credential:", body.rawId);
        console.log('   -> Expected Challenge:', expectedChallenge);
        console.log('   -> Credential ID:', body.rawId);

        let verification;
        try {
            verification = await verifyAuthenticationResponse({
                response: body,
                expectedChallenge,
                expectedOrigin: ['https://estateos.pl','https://www.estateos.pl'],
                expectedRPID: 'estateos.pl',
                credential: {
                    id: authenticator.credentialID,
                    publicKey: new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64url')),
                    counter: authenticator.counter,
                },
            });
        } catch (vErr) {
            console.error('❌ [DEBUG] Krytyczny błąd biblioteki verifyAuthenticationResponse:', vErr instanceof Error ? vErr.message : vErr);
            return NextResponse.json({ error: "Błąd biblioteki: " + (vErr instanceof Error ? vErr.message : "Unknown error") }, { status: 400 });
        }

        console.log('📊 [DEBUG] Wynik weryfikacji:', verification.verified ? '✅ SUKCES' : '❌ PORAŻKA');


        if (verification.verified) {
            await prisma.authenticator.update({
                where: { credentialID: authenticator.credentialID },
                data: { counter: verification.authenticationInfo.newCounter }
            });

            cookieStore.delete('passkey_auth_challenge');

            const sessionPayload = encryptSession({ id: user.id, email: user.email, role: user.role });
            cookieStore.set('estateos_session', sessionPayload, {
                httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/'
            });

            return NextResponse.json({ success: true, role: user.role });
        }
        return NextResponse.json({ error: "Błąd kryptograficzny" }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
    }
}
