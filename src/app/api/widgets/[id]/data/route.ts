import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getWidget, updateWidgetData } from '@/lib/db';
import { getWidgetData } from '@/lib/widget-data';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/widgets/:id/data - Get bot-parseable widget data
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const widget = getWidget(id);
    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const data = await getWidgetData(widget);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to get widget data:', error);
    return NextResponse.json(
      { error: 'Failed to get widget data' },
      { status: 500 }
    );
  }
}

// POST /api/widgets/:id/data - Push data to a widget (for bot updates)
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { id } = await params;

  try {
    const widget = getWidget(id);
    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    
    // Update the widget's data cache
    updateWidgetData(id, body);

    // Return the updated data in bot-parseable format
    const updatedWidget = getWidget(id);
    if (!updatedWidget) {
      throw new Error('Failed to fetch updated widget');
    }

    const data = await getWidgetData(updatedWidget);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to push widget data:', error);
    return NextResponse.json(
      { error: 'Failed to push widget data' },
      { status: 500 }
    );
  }
}
