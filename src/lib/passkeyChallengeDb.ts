import { prisma } from '@/lib/prisma';

const REGISTER_TTL_MS = 10 * 60 * 1000;
const LOGIN_TTL_MS = 10 * 60 * 1000;

function registerIdentifier(userId: number) {
  return `passkey-register:${userId}`;
}

function loginIdentifier(sessionId: string) {
  return `passkey-login:${sessionId}`;
}

export async function savePasskeyRegisterChallenge(userId: number, challenge: string) {
  const identifier = registerIdentifier(userId);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: challenge,
      expires: new Date(Date.now() + REGISTER_TTL_MS),
    },
  });
}

export async function getPasskeyRegisterChallenge(userId: number): Promise<string | null> {
  const row = await prisma.verificationToken.findFirst({
    where: {
      identifier: registerIdentifier(userId),
      expires: { gt: new Date() },
    },
    orderBy: { expires: 'desc' },
  });
  return row?.token ?? null;
}

export async function clearPasskeyRegisterChallenge(userId: number) {
  await prisma.verificationToken.deleteMany({ where: { identifier: registerIdentifier(userId) } });
}

export async function savePasskeyLoginChallenge(sessionId: string, challenge: string) {
  const identifier = loginIdentifier(sessionId);
  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: challenge,
      expires: new Date(Date.now() + LOGIN_TTL_MS),
    },
  });
}

export async function getPasskeyLoginChallenge(sessionId: string): Promise<string | null> {
  const row = await prisma.verificationToken.findFirst({
    where: {
      identifier: loginIdentifier(sessionId),
      expires: { gt: new Date() },
    },
  });
  return row?.token ?? null;
}

export async function clearPasskeyLoginChallenge(sessionId: string) {
  await prisma.verificationToken.deleteMany({ where: { identifier: loginIdentifier(sessionId) } });
}
