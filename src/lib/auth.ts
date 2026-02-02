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

/**
 * Validate Bearer token from Authorization header
 */
export function validateAuth(request: NextRequest): AuthResult {
  const AUTH_TOKEN = getAuthToken();
  
  // If no AUTH_TOKEN is configured, allow all requests (dev mode)
  if (!AUTH_TOKEN) {
    return { authorized: true };
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
  
  // Allow requests from localhost dashboard
  if (origin) {
    const originUrl = new URL(origin);
    if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') {
      return true;
    }
    // Allow same-origin requests (e.g., Tailscale IP accessing itself)
    if (host && originUrl.host === host) {
      return true;
    }
    // Allow Tailscale IPs (100.x.x.x)
    if (originUrl.hostname.startsWith('100.')) {
      return true;
    }
  }
  
  if (referer) {
    const refererUrl = new URL(referer);
    if (refererUrl.hostname === 'localhost' || refererUrl.hostname === '127.0.0.1') {
      return true;
    }
    // Allow Tailscale IPs
    if (refererUrl.hostname.startsWith('100.')) {
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
