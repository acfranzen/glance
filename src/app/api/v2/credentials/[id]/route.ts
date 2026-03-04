import { NextRequest } from 'next/server';
import { GET as legacyGET, PUT as legacyPUT, DELETE as legacyDELETE } from '@/app/api/credentials/[id]/route';
import { withV2Envelope } from '@/app/api/v2/_compat';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyGET(request, context));
}

export async function PUT(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyPUT(request, context));
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyDELETE(request, context));
}
