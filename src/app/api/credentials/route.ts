import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import {
  listCredentials,
  createCredential,
  validateCredential,
  getCredentialStatus,
  PROVIDERS,
  Provider,
} from '@/lib/credentials';
import { getAllCustomWidgets } from '@/lib/db';
import { inferRequiredCredentialProviders } from '@/platform/contracts/custom-widget-semantic';
import { enforceWriteGuards } from '@/lib/request-guards';

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

  const required_by_provider: Record<string, string[]> = {};
  const missing_required_providers = new Set<string>();
  const configuredProviders = new Set(
    Object.entries(status)
      .filter(([, providerStatus]) => providerStatus.configured)
      .map(([provider]) => provider)
  );

  for (const widget of getAllCustomWidgets(true)) {
    const requiredProviders = inferRequiredCredentialProviders(widget);
    for (const provider of requiredProviders) {
      required_by_provider[provider] = required_by_provider[provider] || [];
      required_by_provider[provider].push(widget.slug);
      if (!configuredProviders.has(provider)) {
        missing_required_providers.add(provider);
      }
    }
  }

  return NextResponse.json({
    credentials,
    status,
    providers,
    required_by_provider,
    missing_required_providers: [...missing_required_providers],
  });
}

// POST /api/credentials - Add a new credential
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  const guardResponse = enforceWriteGuards(request, { maxBytes: 64 * 1024, rateLimit: 40 });
  if (guardResponse) {
    return guardResponse;
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
