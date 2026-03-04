import { NextRequest } from 'next/server';
import { POST as legacyPOST } from '@/app/api/custom-widgets/[slug]/execute/route';
import { withV2Envelope } from '@/app/api/v2/_compat';

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  return withV2Envelope(await legacyPOST(request, context));
}
