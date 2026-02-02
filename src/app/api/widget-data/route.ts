import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getDataProviderBySlug, type DataProvider } from '@/lib/db';
import { getCredentialValue, getCredential, Provider } from '@/lib/credentials';

interface WidgetDataRequest {
  widget_id: string;
  provider: string;
  query: {
    endpoint: string;
    params?: Record<string, string | number | boolean>;
    method?: 'GET' | 'POST';
    body?: unknown;
  };
}

// Build the full URL with parameter substitution
function buildUrl(baseUrl: string, endpoint: string, params?: Record<string, string | number | boolean>): string {
  let url = endpoint;
  const remainingParams = params ? { ...params } : {};
  
  // Replace path parameters like {owner} with values from params
  url = url.replace(/\{(\w+)\}/g, (_, key) => {
    const value = remainingParams[key];
    if (value !== undefined) {
      delete remainingParams[key]; // Remove from params so it's not added as query param
      return encodeURIComponent(String(value));
    }
    return `{${key}}`; // Keep original if not found
  });

  // Ensure endpoint starts with /
  if (!url.startsWith('/') && !url.startsWith('http')) {
    url = '/' + url;
  }

  const fullUrl = new URL(url, baseUrl);

  // Add remaining params as query parameters
  for (const [key, value] of Object.entries(remainingParams)) {
    if (value !== undefined && value !== null) {
      fullUrl.searchParams.set(key, String(value));
    }
  }

  return fullUrl.toString();
}

// Build headers based on provider auth type
function buildHeaders(
  provider: DataProvider, 
  credential: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...provider.default_headers,
  };

  if (!credential) {
    return headers;
  }

  switch (provider.auth_type) {
    case 'bearer':
      headers['Authorization'] = `Bearer ${credential}`;
      break;
    
    case 'basic':
      // credential should be in format "username:password"
      headers['Authorization'] = `Basic ${Buffer.from(credential).toString('base64')}`;
      break;
    
    case 'header':
      // credential should be in format "HeaderName: value"
      const colonIndex = credential.indexOf(':');
      if (colonIndex > 0) {
        const headerName = credential.slice(0, colonIndex).trim();
        const headerValue = credential.slice(colonIndex + 1).trim();
        headers[headerName] = headerValue;
      }
      break;
    
    case 'none':
      // No auth needed
      break;
  }

  return headers;
}

// POST /api/widget-data - Proxy data requests with credential injection
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body: WidgetDataRequest = await request.json();

    // Validate request
    if (!body.widget_id) {
      return NextResponse.json({ error: 'widget_id is required' }, { status: 400 });
    }

    if (!body.provider) {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    if (!body.query?.endpoint) {
      return NextResponse.json({ error: 'query.endpoint is required' }, { status: 400 });
    }

    // Look up the provider by slug from database
    const provider = getDataProviderBySlug(body.provider);
    
    if (!provider) {
      return NextResponse.json(
        { error: `Unknown provider: ${body.provider}. Create it via /api/data-providers first.` },
        { status: 404 }
      );
    }

    // Get credential if provider has one configured
    let credential: string | null = null;
    
    if (provider.credential_id) {
      // Use specific credential from database
      credential = getCredentialValue(provider.credential_id);
    } else if (provider.auth_type !== 'none') {
      // Try to get credential by provider slug (legacy fallback)
      // This maps common slugs to the Provider type
      const legacyProviders: Record<string, Provider> = {
        'github': 'github',
        'anthropic': 'anthropic',
        'openai': 'openai',
        'vercel': 'vercel',
      };
      const legacyProvider = legacyProviders[provider.slug];
      if (legacyProvider) {
        credential = getCredential(legacyProvider);
      }
    }

    if (provider.auth_type !== 'none' && !credential) {
      return NextResponse.json(
        { error: `No credentials configured for provider "${provider.name}". Add credentials in settings.` },
        { status: 403 }
      );
    }

    // Build the request
    const url = buildUrl(provider.base_url, body.query.endpoint, body.query.params);
    const method = body.query.method || 'GET';
    const headers = buildHeaders(provider, credential);

    // Make the request
    const response = await fetch(url, {
      method,
      headers,
      body: method !== 'GET' && body.query.body 
        ? JSON.stringify(body.query.body) 
        : undefined,
    });

    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Provider ${provider.name} returned ${response.status}:`, errorText);
      
      return NextResponse.json(
        { 
          error: `Provider returned ${response.status}`,
          details: response.status === 401 
            ? 'Authentication failed. Check your credentials.' 
            : errorText.slice(0, 200)
        },
        { status: response.status }
      );
    }

    // Parse and return data
    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return NextResponse.json({ 
      data,
      provider: provider.slug,
      cached: false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Widget data request failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}
