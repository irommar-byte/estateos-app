import jwt from 'jsonwebtoken';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Missing JWT_SECRET');
  }
  return secret;
}

export const signMobileToken = (payload: any) => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' }); // Token ważny 30 dni
};

export const verifyMobileToken = (token: string) => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) { console.log("VERIFY ERROR:", error);
    return null;
  }
};
