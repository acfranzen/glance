import { NextRequest } from 'next/server';
import { GET as legacyGET, POST as legacyPOST } from '@/app/api/widgets/route';
import { withV2Envelope } from '@/app/api/v2/_compat';

export async function GET(request: NextRequest) {
  return withV2Envelope(await legacyGET(request));
}

export async function POST(request: NextRequest) {
  return withV2Envelope(await legacyPOST(request));
}
