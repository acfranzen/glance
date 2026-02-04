import { NextRequest, NextResponse } from 'next/server';

// Prevent static generation - this route requires runtime database access
export const dynamic = 'force-dynamic';
import { validateAuthOrInternal } from '@/lib/auth';
import { getLayout, updateLayout, getSetting, setSetting, logEvent } from '@/lib/db';
import type { GridLayout } from '@/types/api';

export interface CustomTheme {
  name: string;
  lightCss: string;
  darkCss: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/layout - Get the dashboard layout and theme
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const layout = getLayout();

    // Also get theme
    let theme: CustomTheme | null = null;
    const themeJson = getSetting("custom_theme");
    if (themeJson) {
      theme = JSON.parse(themeJson) as CustomTheme;
    }

    return NextResponse.json({ layout, theme });
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

// PUT /api/layout - Save a custom theme
export async function PUT(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, lightCss, darkCss } = body as {
      name: string;
      lightCss: string;
      darkCss: string;
    };

    if (!name || (!lightCss && !darkCss)) {
      return NextResponse.json(
        { error: "Name and at least one theme CSS are required" },
        { status: 400 },
      );
    }

    const existingThemeJson = getSetting("custom_theme");
    const now = new Date().toISOString();

    const theme: CustomTheme = {
      name,
      lightCss: lightCss || "",
      darkCss: darkCss || "",
      createdAt: existingThemeJson
        ? JSON.parse(existingThemeJson).createdAt
        : now,
      updatedAt: now,
    };

    setSetting("custom_theme", JSON.stringify(theme));
    logEvent("theme_saved", { name });

    return NextResponse.json({ theme, success: true });
  } catch (error) {
    console.error("Failed to save custom theme:", error);
    return NextResponse.json(
      { error: "Failed to save custom theme" },
      { status: 500 },
    );
  }
}

// DELETE /api/layout - Remove the custom theme (layout cannot be deleted)
export async function DELETE(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    setSetting("custom_theme", "");
    logEvent("theme_deleted", {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete custom theme:", error);
    return NextResponse.json(
      { error: "Failed to delete custom theme" },
      { status: 500 },
    );
  }
}
