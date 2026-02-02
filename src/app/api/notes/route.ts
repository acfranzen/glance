import { NextRequest, NextResponse } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getNote, upsertNote } from '@/lib/db';

// GET /api/notes?widgetId=xxx - Get notes for a widget
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const widgetId = searchParams.get('widgetId');

    if (!widgetId) {
      return NextResponse.json(
        { error: 'widgetId is required' },
        { status: 400 }
      );
    }

    const note = getNote(widgetId);
    return NextResponse.json({
      widgetId,
      content: note?.content || '',
      updatedAt: note?.updated_at || null,
    });
  } catch (error) {
    console.error('Failed to fetch notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// POST /api/notes - Save notes for a widget
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { widgetId, content } = body;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'widgetId is required' },
        { status: 400 }
      );
    }

    upsertNote(widgetId, content || '');

    const note = getNote(widgetId);
    return NextResponse.json({
      widgetId,
      content: note?.content || '',
      updatedAt: note?.updated_at || null,
    });
  } catch (error) {
    console.error('Failed to save notes:', error);
    return NextResponse.json(
      { error: 'Failed to save notes' },
      { status: 500 }
    );
  }
}
