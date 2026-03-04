import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authorized: boolean;
  error?: string;
}

/**
 * Get the auth token from environment at runtime
 */
function getAuthToken(): string | undefined {
  return process.env.AUTH_TOKEN;
}

function allowUnauthenticatedLocal(): boolean {
  return process.env.ALLOW_UNAUTH_LOCAL !== 'false';
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  );
}

/**
 * Validate Bearer token from Authorization header
 */
export function validateAuth(request: NextRequest): AuthResult {
  const AUTH_TOKEN = getAuthToken();
  
  // Hardened default: only allow unauthenticated local development requests.
  if (!AUTH_TOKEN) {
    if (allowUnauthenticatedLocal() && isInternalRequest(request)) {
      return { authorized: true };
    }
    return { authorized: false, error: 'AUTH_TOKEN is required for non-local requests' };
  }

  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return { authorized: false, error: 'Missing Authorization header' };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Invalid Authorization format. Use: Bearer <token>' };
  }

  const token = authHeader.slice(7); // Remove 'Bearer '
  
  if (token !== AUTH_TOKEN) {
    return { authorized: false, error: 'Invalid token' };
  }

  return { authorized: true };
}

/**
 * Middleware wrapper that validates auth and returns 401 if unauthorized
 */
export function withAuth(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const auth = validateAuth(request);
    
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.error },
        { status: 401 }
      );
    }

    return handler(request);
  };
}

/**
 * Check if the request is coming from the dashboard UI (same origin)
 * This allows the UI to work without explicit auth
 */
export function isInternalRequest(request: NextRequest): boolean {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  const host = request.headers.get('Host');
  
  if (host) {
    const hostName = host.split(':')[0];
    if (isLocalHostname(hostName)) {
      return true;
    }
  }

  // Allow requests from localhost dashboard
  if (origin) {
    const originUrl = new URL(origin);
    if (isLocalHostname(originUrl.hostname)) {
      return true;
    }
  }
  
  if (referer) {
    const refererUrl = new URL(referer);
    if (isLocalHostname(refererUrl.hostname)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Validate auth, but allow internal requests without token
 */
export function validateAuthOrInternal(request: NextRequest): AuthResult {
  if (isInternalRequest(request)) {
    return { authorized: true };
  }
  return validateAuth(request);
}
