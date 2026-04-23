import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { email, response } = await req.json();
        const user = await prisma.user.findUnique({ where: { email }});
        
        if (!user || !user.otpCode) return NextResponse.json({ error: "Brak wyzwania" }, { status: 400 });

        let expectedOrigin = 'http://localhost:3000';
        try {
            if (response.clientDataJSON) {
                const clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64').toString('utf-8'));
                if (clientData.origin) expectedOrigin = clientData.origin;
            }
        } catch (e) {}

        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge: user.otpCode,
            expectedOrigin,
            expectedRPID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            requireUserVerification: false
        });

        if (verification.verified && verification.registrationInfo) {
            const { credentialID, credentialPublicKey, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
            
            await prisma.authenticator.create({
                data: {
                    credentialID: Buffer.from(credentialID).toString('base64url'),
                    credentialPublicKey: Buffer.from(credentialPublicKey).toString('base64url'),
                    counter,
                    credentialDeviceType,
                    credentialBackedUp,
                    providerAccountId: 'passkey',
                    userId: user.id
                }
            });

            await prisma.user.update({ where: { id: user.id }, data: { otpCode: null } });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Weryfikacja nie powiodła się" }, { status: 400 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}