import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        const user = await prisma.user.findUnique({ where: { email }});
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });

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
            authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
        });

        await prisma.user.update({ where: { id: user.id }, data: { otpCode: options.challenge } });
        return NextResponse.json(options);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}