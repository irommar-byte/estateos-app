import { assertCriticalEnv } from '@/lib/env.server';
import { logEvent } from '@/lib/observability';

export async function register() {
  try {
    assertCriticalEnv();
    logEvent('info', 'startup_env_validation_ok', 'instrumentation.register');
  } catch (error) {
    logEvent('error', 'startup_env_validation_failed', 'instrumentation.register', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { startKeiAutoImportHeartbeat } = await import('@/lib/keiAutoImport');
  startKeiAutoImportHeartbeat();
}
