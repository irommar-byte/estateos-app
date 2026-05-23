import { PrismaClient } from '@prisma/client'
import { isOfferAlterPrivilegeError, isOfferLegalColumnMissingError } from '@/lib/offerSchemaErrors'

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

let offerColumnsEnsured = false
let offerColumnsPromise: Promise<void> | null = null
let offerEnsureWarningPrinted = false

function isIgnorableAddColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Duplicate column name/i.test(message) || /already exists/i.test(message)
}

function isAddColumnSyntaxError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /syntax/i.test(message) && /if not exists/i.test(message)
}

async function hasOfferColumn(prisma: PrismaClient, columnName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ total: number | string | bigint }>>(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'Offer'
        AND column_name = ?
    `,
    columnName
  )
  return Number(rows?.[0]?.total ?? 0) > 0
}

async function ensureOfferColumn(prisma: PrismaClient, columnName: string): Promise<void> {
  const quotedColumn = `\`${columnName}\``
  const alterSql = `ALTER TABLE \`Offer\` ADD COLUMN IF NOT EXISTS ${quotedColumn} VARCHAR(64) NULL`

  try {
    await prisma.$executeRawUnsafe(alterSql)
    return
  } catch (error) {
    if (isIgnorableAddColumnError(error)) return
    if (!isAddColumnSyntaxError(error)) throw error
  }

  const exists = await hasOfferColumn(prisma, columnName)
  if (!exists) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`Offer\` ADD COLUMN ${quotedColumn} VARCHAR(64) NULL`
    )
  }
}

/** Zgodnie z Prisma: `legalCheckStatus` VARCHAR(16) default NONE — brak kolumny powodował P2022 w prod. */
async function ensureOfferLegalCheckStatusColumn(prisma: PrismaClient): Promise<void> {
  if (await hasOfferColumn(prisma, 'legalCheckStatus')) return
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Offer` ADD COLUMN IF NOT EXISTS `legalCheckStatus` VARCHAR(16) NOT NULL DEFAULT 'NONE'"
    )
  } catch (error) {
    if (isIgnorableAddColumnError(error)) return
    if (!isAddColumnSyntaxError(error)) throw error
  }
  if (!(await hasOfferColumn(prisma, 'legalCheckStatus'))) {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `Offer` ADD COLUMN `legalCheckStatus` VARCHAR(16) NOT NULL DEFAULT 'NONE'"
    )
  }
}

async function ensureOfferLegalColumns(prisma: PrismaClient): Promise<void> {
  if (offerColumnsEnsured) return
  if (offerColumnsPromise) return offerColumnsPromise

  offerColumnsPromise = (async () => {
    await ensureOfferColumn(prisma, 'landRegistryNumber')
    await ensureOfferColumn(prisma, 'apartmentNumber')
    await ensureOfferLegalCheckStatusColumn(prisma)
    offerColumnsEnsured = true
  })()

  try {
    await offerColumnsPromise
  } finally {
    offerColumnsPromise = null
  }
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

prisma.$use(async (params, next) => {
  if (params.model === 'Offer') {
    try {
      await ensureOfferLegalColumns(prisma)
    } catch (error) {
      if (isOfferAlterPrivilegeError(error) || isOfferLegalColumnMissingError(error)) {
        offerColumnsEnsured = true
        if (!offerEnsureWarningPrinted) {
          offerEnsureWarningPrinted = true
          console.warn(
            '[Offer schema guard] Missing ALTER permission or legacy schema detected. Running in fallback mode.'
          )
        }
      } else {
        throw error
      }
    }
  }
  return next(params)
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}




