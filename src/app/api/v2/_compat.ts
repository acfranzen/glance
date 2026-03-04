import { NextResponse } from 'next/server';

export async function withV2Envelope(response: Response): Promise<NextResponse> {
  let body: unknown = null;
  const status = response.status;
  try {
    body = await response.clone().json();
  } catch {
    return new NextResponse(response.body, {
      status,
      headers: response.headers,
    });
  }

  if (body && typeof body === 'object') {
    return NextResponse.json(
      {
        api_version: 'v2',
        ...(body as Record<string, unknown>),
      },
      { status }
    );
  }

  return NextResponse.json({ api_version: 'v2', data: body }, { status });
}
