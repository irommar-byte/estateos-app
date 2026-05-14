import crypto from 'crypto';

function resolveSessionSecret(): string {
    const fromEnv =
        process.env.AUTH_SECRET ||
        process.env.NEXTAUTH_SECRET ||
        process.env.JWT_SECRET ||
        '';
    const normalized = String(fromEnv).trim();
    if (normalized) return normalized;
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Missing AUTH_SECRET/NEXTAUTH_SECRET/JWT_SECRET for session signing');
    }
    return 'DEV_ONLY_CHANGE_ME_SECRET';
}

export function encryptSession(payload: Record<string, unknown>) {
    const secret = resolveSessionSecret();
    const enriched = {
        ...payload,
        exp: Date.now() + (1000 * 60 * 60 * 24 * 30) // 30 dni
    };

    const data = Buffer.from(JSON.stringify(enriched)).toString('base64');
    const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
    return `${data}.${signature}`;
}

export function decryptSession(token: string) {
    try {
        const secret = resolveSessionSecret();
        if (!token) return null;

        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [data, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('hex');

        if (signature !== expectedSig) return null;

        const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

        if (decoded.exp && decoded.exp < Date.now()) {
            return null;
        }

        return decoded;
    } catch {
        return null;
    }
}
