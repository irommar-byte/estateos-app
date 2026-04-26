import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      radarPrefsTotal,
      radarPushActive,
      radarNotificationsTotal,
      radarNotificationsDelivered,
      radarNotificationsFailed,
      radarPreferences
    ] = await Promise.all([
      prisma.radarPreference.count(),
      prisma.radarPreference.count({ where: { pushNotifications: true } }),
      prisma.notification.count({ where: { type: "AI_RADAR" } }),
      prisma.notification.count({ where: { type: "AI_RADAR", status: { in: ["SENT", "DELIVERED", "READ"] } } }),
      prisma.notification.count({ where: { type: "AI_RADAR", status: "FAILED" } }),
      prisma.radarPreference.findMany({ select: { minMatchThreshold: true, city: true } }),
    ]);

    const thresholdBands = { strict100: 0, high85_99: 0, medium70_84: 0, broad50_69: 0, below50: 0 };
    const cityDistribution = new Map<string, number>();

    for (const pref of radarPreferences) {
      const t = Number(pref.minMatchThreshold ?? 70);
      if (t >= 100) thresholdBands.strict100 += 1;
      else if (t >= 85) thresholdBands.high85_99 += 1;
      else if (t >= 70) thresholdBands.medium70_84 += 1;
      else if (t >= 50) thresholdBands.broad50_69 += 1;
      else thresholdBands.below50 += 1;

      const c = pref.city || "Nieokreślone";
      cityDistribution.set(c, (cityDistribution.get(c) || 0) + 1);
    }

    return NextResponse.json({
      success: true,
      radar: {
        kpis: {
          preferencesTotal: radarPrefsTotal,
          pushActive: radarPushActive,
          notificationsTotal: radarNotificationsTotal,
          notificationsDelivered: radarNotificationsDelivered,
          notificationsFailed: radarNotificationsFailed,
        },
        thresholdBands,
        cityDistribution: Array.from(cityDistribution.entries())
          .map(([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || "Błąd serwera" }, { status: 500 });
  }
}
