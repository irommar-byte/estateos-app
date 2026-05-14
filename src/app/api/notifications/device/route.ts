import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';
import { logEvent } from '@/lib/observability';
import { tokenRef } from '@/lib/pushTelemetry';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) {
    return verifiedId;
  }

  // Fallback dla tokenów podpisanych innym sekretem (np. część flow passkey).
  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  if (Number.isFinite(decodedId) && decodedId > 0) {
    return decodedId;
  }

  return null;
}

/** Szybki test z przeglądarki / curl GET — potwierdza TLS i routing bez body tokena Expo. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/notifications/device',
    hint: 'Rejestracja push: POST + JSON { expoPushToken, platform?, ... } + Authorization: Bearer',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const authHeader = req.headers.get("authorization");
    const userId = parseUserIdFromAuthHeader(authHeader);
    if (!userId) {
      logEvent('warn', 'device_push_preferences_rejected', 'notifications_device', {
        reason: 'missing_or_invalid_auth',
        statusCode: 401,
      });
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    let { expoPushToken, platform = 'IOS', deviceModel = 'Unknown', appVersion = '1.0' } = body;
    const favoritesRaw = body?.favorites;
    expoPushToken = String(expoPushToken || '').replace(/\s+/g, '').trim();

    if (!expoPushToken) {
      logEvent('warn', 'device_push_preferences_rejected', 'notifications_device', {
        reason: 'missing_expo_push_token',
        statusCode: 400,
        userId,
      });
      return NextResponse.json({ error: 'Brak tokena w body' }, { status: 400 });
    }
    if (favoritesRaw != null && typeof favoritesRaw !== 'object') {
      logEvent('warn', 'device_push_preferences_rejected', 'notifications_device', {
        reason: 'invalid_favorites_type',
        statusCode: 400,
        userId,
      });
      return NextResponse.json({ error: 'Nieprawidłowe pole favorites' }, { status: 400 });
    }
    const favorites = (favoritesRaw || {}) as Record<string, unknown>;
    const notifyNegotiation =
      typeof favorites.notifyNegotiation === 'boolean' ? favorites.notifyNegotiation : undefined;

    const typedBoolean = (value: unknown, field: string): boolean | undefined => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      throw new Error(`invalid_favorites_field_type:${field}`);
    };

    const idsRaw = favorites.ids;
    if (idsRaw !== undefined) {
      const validIds =
        Array.isArray(idsRaw) &&
        idsRaw.every((id) => Number.isFinite(Number(id)) && Number(id) > 0);
      if (!validIds) {
        logEvent('warn', 'device_push_preferences_rejected', 'notifications_device', {
          reason: 'invalid_favorites_field_type:ids',
          statusCode: 400,
          userId,
        });
        return NextResponse.json({ error: 'Nieprawidłowe pole favorites.ids' }, { status: 400 });
      }
    }

    const prefInput = {
      favoritesEnabled: typedBoolean(favorites.enabled, 'enabled'),
      notifyPriceChange: typedBoolean(favorites.notifyPriceChange, 'notifyPriceChange'),
      notifyDealProposals: typedBoolean(
        favorites.notifyDealProposals ?? notifyNegotiation,
        'notifyDealProposals'
      ),
      notifyIncludeAmounts: typedBoolean(favorites.notifyIncludeAmounts, 'notifyIncludeAmounts'),
      notifyStatusChange: typedBoolean(favorites.notifyStatusChange, 'notifyStatusChange'),
      notifyNewSimilar: typedBoolean(favorites.notifyNewSimilar, 'notifyNewSimilar'),
    };

    await prisma.$transaction(async (tx) => {
      // Jeden fizyczny token urządzenia ma należeć tylko do jednego konta.
      await tx.device.updateMany({
        where: {
          expoPushToken,
          userId: { not: userId },
        },
        data: {
          isActive: false,
        },
      });

      await tx.device.upsert({
        where: {
          userId_expoPushToken: {
            userId,
            expoPushToken
          }
        },
        update: {
          isActive: true,
          platform,
          deviceModel,
          appVersion,
          lastSyncedAt: new Date()
        },
        create: {
          userId,
          expoPushToken,
          platform,
          deviceModel,
          appVersion,
          isActive: true
        }
      });

      const existingPref = await tx.devicePushPreference.findUnique({ where: { userId } });
      const resolvedPref = {
        favoritesEnabled: prefInput.favoritesEnabled ?? existingPref?.favoritesEnabled ?? true,
        notifyPriceChange: prefInput.notifyPriceChange ?? existingPref?.notifyPriceChange ?? true,
        notifyDealProposals: prefInput.notifyDealProposals ?? existingPref?.notifyDealProposals ?? true,
        notifyIncludeAmounts: prefInput.notifyIncludeAmounts ?? existingPref?.notifyIncludeAmounts ?? true,
        notifyStatusChange: prefInput.notifyStatusChange ?? existingPref?.notifyStatusChange ?? true,
        notifyNewSimilar: prefInput.notifyNewSimilar ?? existingPref?.notifyNewSimilar ?? true,
      };

      await tx.devicePushPreference.upsert({
        where: { userId },
        create: {
          userId,
          ...resolvedPref,
        },
        update: {
          ...resolvedPref,
        },
      });

      logEvent('info', 'device_push_preferences_upserted', 'notifications_device', {
        userId,
        expoPushToken: tokenRef(expoPushToken),
        platform,
        deviceModel,
        appVersion,
        favorites: {
          enabled: resolvedPref.favoritesEnabled,
          notifyPriceChange: resolvedPref.notifyPriceChange,
          notifyDealProposals: resolvedPref.notifyDealProposals,
          notifyIncludeAmounts: resolvedPref.notifyIncludeAmounts,
          notifyStatusChange: resolvedPref.notifyStatusChange,
          notifyNewSimilar: resolvedPref.notifyNewSimilar,
        },
        idsCount: Array.isArray(idsRaw) ? idsRaw.length : 0,
        storedAt: new Date().toISOString(),
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    if (String(error?.message || '').startsWith('invalid_favorites_field_type:')) {
      const field = String(error.message).split(':')[1] || 'unknown';
      logEvent('warn', 'device_push_preferences_rejected', 'notifications_device', {
        reason: `invalid_favorites_field_type:${field}`,
        statusCode: 400,
      });
      return NextResponse.json({ error: `Nieprawidłowe pole favorites.${field}` }, { status: 400 });
    }
    logEvent('error', 'device_push_preferences_rejected', 'notifications_device', {
      reason: error?.message || 'internal_error',
      statusCode: 500,
    });
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}
