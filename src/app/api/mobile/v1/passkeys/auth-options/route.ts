import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const { email } = await req.json();
        const user = await prisma.user.findUnique({ where: { email }});
        if (!user) return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 404 });

        const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });
        if (!authenticators.length) return NextResponse.json({ error: "Brak kluczy Passkey" }, { status: 400 });

        const options = await generateAuthenticationOptions({
            rpID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            allowCredentials: authenticators.map(auth => ({
                id: new Uint8Array(Buffer.from(auth.credentialID, 'base64url')),
                type: 'public-key',
            })),
            userVerification: 'preferred',
        });

        await prisma.user.update({ where: { id: user.id }, data: { otpCode: options.challenge } });
        return NextResponse.json(options);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function GET() {
    try {
        const authenticators = await prisma.authenticator.findMany();

        const options = await generateAuthenticationOptions({
            rpID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            userVerification: 'preferred',
            allowCredentials: authenticators.map(auth => ({
                id: new Uint8Array(Buffer.from(auth.credentialID, 'base64url')),
                type: 'public-key',
            })),
        });

        return NextResponse.json(options);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
