import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback
}

export function buildPrismaDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw
  try {
    const url = new URL(raw)
    if (!/^mysql:$/.test(url.protocol)) return raw
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set(
        'connection_limit',
        String(boundedInteger(process.env.PRISMA_CONNECTION_LIMIT, 6, 1, 20)),
      )
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set(
        'pool_timeout',
        String(boundedInteger(process.env.PRISMA_POOL_TIMEOUT_SECONDS, 10, 1, 60)),
      )
    }
    if (!url.searchParams.has('connect_timeout')) {
      url.searchParams.set(
        'connect_timeout',
        String(boundedInteger(process.env.PRISMA_CONNECT_TIMEOUT_SECONDS, 5, 1, 30)),
      )
    }
    return url.toString()
  } catch {
    return raw
  }
}

const datasourceUrl = buildPrismaDatabaseUrl(process.env.DATABASE_URL)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}




