import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { nanoid } from 'nanoid';
import { validateAuthOrInternal } from '@/lib/auth';
import { getBookmarks, createBookmark, updateBookmark, deleteBookmark } from '@/lib/db';

// GET /api/bookmarks?widgetId=xxx - Get bookmarks for a widget
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

    const bookmarks = getBookmarks(widgetId);
    return NextResponse.json({
      widgetId,
      bookmarks: bookmarks.map((b) => ({
        id: b.id,
        title: b.title,
        url: b.url,
        icon: b.icon,
        position: b.position,
      })),
    });
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}

// POST /api/bookmarks - Create a new bookmark
export async function POST(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { widgetId, title, url, icon, position } = body;

    if (!widgetId || !title || !url) {
      return NextResponse.json(
        { error: 'widgetId, title, and url are required' },
        { status: 400 }
      );
    }

    const id = nanoid();
    createBookmark(id, widgetId, title, url, icon, position);

    return NextResponse.json({
      id,
      widgetId,
      title,
      url,
      icon,
      position: position || 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

// PATCH /api/bookmarks - Update a bookmark
export async function PATCH(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, title, url, icon, position } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    updateBookmark(id, title, url, icon, position);

    return NextResponse.json({
      id,
      title,
      url,
      icon,
      position,
    });
  } catch (error) {
    console.error('Failed to update bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to update bookmark' },
      { status: 500 }
    );
  }
}

// DELETE /api/bookmarks?id=xxx - Delete a bookmark
export async function DELETE(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    deleteBookmark(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}
