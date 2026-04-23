import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || 'CHANGE_ME_SUPER_SECRET_123456789';

export function encryptSession(payload: any) {
    const enriched = {
        ...payload,
        exp: Date.now() + (1000 * 60 * 60 * 24 * 30) // 30 dni
    };

    const data = Buffer.from(JSON.stringify(enriched)).toString('base64');
    const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
    return `${data}.${signature}`;
}

export function decryptSession(token: string) {
    try {
        if (!token) return null;

        const parts = token.split('.');
        if (parts.length !== 2) return null;

        const [data, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', SECRET).update(data).digest('hex');

        if (signature !== expectedSig) return null;

        const decoded = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

        if (decoded.exp && decoded.exp < Date.now()) {
            return null;
        }

        return decoded;
    } catch (e) {
        return null;
    }
}
