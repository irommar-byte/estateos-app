import jwt from 'jsonwebtoken';

function getJwtSecrets(): string[] {
  const fromEnv = [
    process.env.JWT_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.AUTH_SECRET,
  ]
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  return Array.from(new Set(fromEnv));
}

function getPrimaryJwtSecret(): string {
  const [first] = getJwtSecrets();
  if (!first) {
    throw new Error('Missing JWT secret (JWT_SECRET/NEXTAUTH_SECRET/AUTH_SECRET)');
  }
  return first;
}

export const signMobileToken = (payload: any) => {
  return jwt.sign(payload, getPrimaryJwtSecret(), { expiresIn: '30d' }); // Token ważny 30 dni
};

export const verifyMobileToken = (token: string) => {
  const secrets = getJwtSecrets();
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch {
      // try next secret
    }
  }
  return null;
};
