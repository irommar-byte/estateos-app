type Meta = Record<string, unknown>;

type Level = 'info' | 'warn' | 'error';

const REDACT_KEYS = ['password', 'token', 'authorization', 'cookie', 'secret', 'credential', 'email', 'phone'];

function sanitizeValue(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
      const shouldRedact = REDACT_KEYS.some((needle) => k.toLowerCase().includes(needle));
      return [k, shouldRedact ? '[REDACTED]' : sanitizeValue(v)];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

export function logEvent(level: Level, event: string, context: string, metadata: Meta = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    context,
    metadata: sanitizeValue(metadata),
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }
  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0]?.trim() || 'unknown';
  }
  return req.headers.get('x-real-ip') || 'unknown';
}
