import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getLayout, updateLayout } from '@/lib/db';
import type { GridLayout } from '@/types/api';

// GET /api/layout - Get the dashboard layout
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const layout = getLayout();
    return NextResponse.json({ layout });
  } catch (error) {
    console.error('Failed to fetch layout:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layout' },
      { status: 500 }
    );
  }
}

// POST /api/layout - Update the dashboard layout
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const layout: GridLayout[] = body.layout;

    if (!Array.isArray(layout)) {
      return NextResponse.json(
        { error: 'Layout must be an array' },
        { status: 400 }
      );
    }

    // Validate layout items
    for (const item of layout) {
      if (!item.i || typeof item.x !== 'number' || typeof item.y !== 'number' ||
          typeof item.w !== 'number' || typeof item.h !== 'number') {
        return NextResponse.json(
          { error: 'Invalid layout item. Each item must have i, x, y, w, h' },
          { status: 400 }
        );
      }
    }

    updateLayout(layout);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update layout:', error);
    return NextResponse.json(
      { error: 'Failed to update layout' },
      { status: 500 }
    );
  }
}
