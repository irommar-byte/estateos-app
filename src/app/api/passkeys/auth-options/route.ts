import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const options = await generateAuthenticationOptions({
            rpID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
            userVerification: 'preferred',
        });

        const cookieStore = await cookies();
        cookieStore.set('passkey_auth_challenge', options.challenge, {
            httpOnly: true,
            maxAge: 60 * 5,
            path: '/'
        });

        return NextResponse.json(options);
    } catch (error) {
        return NextResponse.json({ error: "Błąd generowania opcji" }, { status: 500 });
    }
}
