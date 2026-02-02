import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  listCredentials,
  createCredential,
  validateCredential,
  getCredentialStatus,
  PROVIDERS,
  Provider,
} from '@/lib/credentials';

// GET /api/credentials - List all credentials (without values)
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const credentials = listCredentials();
  const status = getCredentialStatus();
  const providers = Object.entries(PROVIDERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    description: config.description,
    hasEnvFallback: !!config.envFallback && !!process.env[config.envFallback],
  }));

  return NextResponse.json({
    credentials,
    status,
    providers,
  });
}

// POST /api/credentials - Add a new credential
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { provider, name, value, metadata, skipValidation } = body;

    if (!provider || !name || !value) {
      return NextResponse.json(
        { error: 'Missing required fields: provider, name, value' },
        { status: 400 }
      );
    }

    if (!Object.keys(PROVIDERS).includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${Object.keys(PROVIDERS).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate the credential before storing (unless skipped)
    if (!skipValidation) {
      const validation = await validateCredential(provider as Provider, value);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Credential validation failed: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const credential = createCredential(
      provider as Provider,
      name,
      value,
      metadata || {}
    );

    return NextResponse.json({
      success: true,
      credential,
    });
  } catch (error) {
    console.error('Failed to create credential:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create credential' },
      { status: 500 }
    );
  }
}
