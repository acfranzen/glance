import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';

import { validateAuthOrInternal } from '@/lib/auth';
import { updateLayout, getWidget } from '@/lib/db';

interface LayoutItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BulkLayoutRequest {
  layout: LayoutItem[];
}

// PUT /api/dashboard/layout - Bulk update all widget positions
export async function PUT(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body: BulkLayoutRequest = await request.json();

    if (!body.layout || !Array.isArray(body.layout)) {
      return NextResponse.json(
        { error: 'layout must be an array' },
        { status: 400 }
      );
    }

    // Validate all widget IDs exist before updating
    const missingIds: string[] = [];
    for (const item of body.layout) {
      if (!item.id) {
        return NextResponse.json(
          { error: 'Each layout item must have an id' },
          { status: 400 }
        );
      }
      const widget = getWidget(item.id);
      if (!widget) {
        missingIds.push(item.id);
      }
    }

    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Widget instances not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Validate position values
    for (const item of body.layout) {
      if (
        typeof item.x !== 'number' ||
        typeof item.y !== 'number' ||
        typeof item.w !== 'number' ||
        typeof item.h !== 'number'
      ) {
        return NextResponse.json(
          { error: `Invalid position values for widget "${item.id}"` },
          { status: 400 }
        );
      }
      if (item.x < 0 || item.y < 0 || item.w < 1 || item.h < 1) {
        return NextResponse.json(
          { error: `Position values must be non-negative for widget "${item.id}"` },
          { status: 400 }
        );
      }
    }

    // Convert to the format expected by updateLayout (uses 'i' instead of 'id')
    const layoutItems = body.layout.map((item) => ({
      i: item.id,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
    }));

    // Update all positions in a single transaction
    updateLayout(layoutItems);

    return NextResponse.json({
      success: true,
      updated: body.layout.length,
    });
  } catch (error) {
    console.error('Failed to update layout:', error);
    return NextResponse.json(
      { error: 'Failed to update layout' },
      { status: 500 }
    );
  }
}
