import { NextResponse } from 'next/server';
import { getMetricsSnapshot } from '@/lib/pushTelemetry';

export async function GET() {
  return NextResponse.json({
    success: true,
    metrics: getMetricsSnapshot(),
    generatedAt: new Date().toISOString(),
  });
}
