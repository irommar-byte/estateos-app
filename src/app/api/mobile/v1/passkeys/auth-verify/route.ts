import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { email, response } = await req.json();
        const user = await prisma.user.findUnique({ where: { email }});
        if (!user || !user.otpCode) return NextResponse.json({ error: "Brak wyzwania" }, { status: 400 });

        const authenticator = await prisma.authenticator.findFirst({
            where: { userId: user.id, credentialID: response.id }
        });

        if (!authenticator) return NextResponse.json({ error: "Nieznany klucz" }, { status: 400 });

        let expectedOrigin = 'http://localhost:3000';
        try {
            if (response.clientDataJSON) {
                const clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString('utf-8'));
                if (clientData.origin) expectedOrigin = clientData.origin;
            }
        } catch (e) {}

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge: user.otpCode,
            expectedOrigin,
            expectedRPID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            authenticator: {
                credentialID: Buffer.from(authenticator.credentialID, 'base64url'),
                credentialPublicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
                counter: authenticator.counter,
            },
        });

        if (verification.verified) {
            try {
                await prisma.authenticator.update({
                    where: { userId_credentialID: { userId: user.id, credentialID: authenticator.credentialID } },
                    data: { counter: verification.authenticationInfo.newCounter }
                });
            } catch(e) {} 
            
            await prisma.user.update({ where: { id: user.id }, data: { otpCode: null } });

            return NextResponse.json({ 
                success: true, 
                user: { id: user.id, email: user.email, role: user.role, name: user.name, image: user.image },
                token: 'session_passkey_' + Math.random().toString(36).substr(2)
            });
        }

        return NextResponse.json({ error: "Weryfikacja nie powiodła się" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}