import { NextRequest } from 'next/server';
import { GET as legacyGET, PATCH as legacyPATCH, DELETE as legacyDELETE } from '@/app/api/widgets/[id]/route';
import { withV2Envelope } from '@/app/api/v2/_compat';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyGET(request, context));
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyPATCH(request, context));
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyDELETE(request, context));
}
