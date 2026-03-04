import type { NextRequest } from 'next/server';

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export function isContentLengthTooLarge(contentLengthHeader: string | null, maxBytes: number): boolean {
  if (!contentLengthHeader) {
    return false;
  }
  const parsed = Number(contentLengthHeader);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return parsed > maxBytes;
}

export function checkRateLimit(opts: RateLimitOptions): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const key = opts.key;
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true };
  }

  if (current.count >= opts.limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true };
}

export function enforceWriteGuards(
  request: NextRequest,
  opts?: {
    maxBytes?: number;
    rateLimit?: number;
    windowMs?: number;
  }
): Response | null {
  const maxBytes = opts?.maxBytes ?? 256 * 1024;
  if (isContentLengthTooLarge(request.headers.get('content-length'), maxBytes)) {
    return Response.json(
      {
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request body exceeds ${maxBytes} bytes`,
        },
      },
      { status: 413 }
    );
  }

  const ip = getClientIp(request);
  const rate = checkRateLimit({
    key: `${ip}:${request.method}:${request.nextUrl.pathname}`,
    limit: opts?.rateLimit ?? 60,
    windowMs: opts?.windowMs ?? 60_000,
  });
  if (!rate.allowed) {
    return Response.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded',
          retry_after_seconds: rate.retryAfterSec,
        },
      },
      { status: 429 }
    );
  }

  return null;
}
