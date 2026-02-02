import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getAllWidgets } from '@/lib/db';
import { getDashboardSnapshot } from '@/lib/widget-data';

// GET /api/snapshot - Get dashboard snapshot for context injection
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') as 'json' | 'markdown' || 'json';

    const widgets = getAllWidgets();
    const snapshot = await getDashboardSnapshot(widgets, format);

    if (format === 'markdown') {
      return new NextResponse(snapshot as string, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
        },
      });
    }

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Failed to generate snapshot:', error);
    return NextResponse.json(
      { error: 'Failed to generate snapshot' },
      { status: 500 }
    );
  }
}
