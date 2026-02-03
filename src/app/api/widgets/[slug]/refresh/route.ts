import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { validateAuthOrInternal } from '@/lib/auth';
import { getCustomWidgetBySlug, getDatabase } from '@/lib/db';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

// Ensure refresh_requests table exists
function ensureRefreshRequestsTable(): void {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_refresh_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_slug TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      processed_at TEXT,
      UNIQUE(widget_slug, requested_at)
    )
  `);
}

// POST /api/widgets/[slug]/refresh
// Stores a refresh request and optionally wakes OpenClaw agent
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const widget = getCustomWidgetBySlug(slug);

    if (!widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Check if this is an agent_refresh widget
    const fetchConfig = widget.fetch;
    if (fetchConfig?.type !== 'agent_refresh') {
      return NextResponse.json(
        { error: 'Only agent_refresh widgets support manual refresh requests' },
        { status: 400 }
      );
    }

    // Ensure table exists and insert the refresh request
    ensureRefreshRequestsTable();
    const db = getDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO widget_refresh_requests (widget_slug, requested_at)
      VALUES (?, ?)
    `).run(slug, now);

    // Try to wake the OpenClaw agent if gateway URL is configured
    const gatewayUrl = process.env.OPENCLAW_GATEWAY_URL;
    const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN;

    if (gatewayUrl && gatewayToken) {
      try {
        await fetch(`${gatewayUrl}/api/cron/wake`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${gatewayToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: `⚡ WIDGET REFRESH REQUESTED: User clicked refresh on "${widget.name}" (${slug}). Collect data now and POST to cache.`,
            mode: 'now'
          })
        });
      } catch (e) {
        // Silently fail - agent will pick it up on next heartbeat
        console.log('Could not wake OpenClaw agent:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Refresh requested',
      slug,
      requestedAt: now
    });

  } catch (error) {
    console.error('Error requesting refresh:', error);
    return NextResponse.json(
      { error: 'Failed to request refresh' },
      { status: 500 }
    );
  }
}

// GET /api/widgets/[slug]/refresh
// Check for pending refresh requests (used by agent)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const db = getDatabase();

    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='widget_refresh_requests'
    `).get();

    if (!tableExists) {
      return NextResponse.json({ pending: false });
    }

    // Get unprocessed refresh requests from last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const pending = db.prepare(`
      SELECT * FROM widget_refresh_requests
      WHERE widget_slug = ?
        AND processed_at IS NULL
        AND requested_at > ?
      ORDER BY requested_at DESC
      LIMIT 1
    `).get(slug, fiveMinutesAgo);

    return NextResponse.json({
      pending: !!pending,
      request: pending || null
    });

  } catch (error) {
    console.error('Error checking refresh requests:', error);
    return NextResponse.json(
      { error: 'Failed to check refresh requests' },
      { status: 500 }
    );
  }
}

// DELETE /api/widgets/[slug]/refresh
// Mark refresh request as processed (called by agent after refresh)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { slug } = await context.params;
    const db = getDatabase();
    const now = new Date().toISOString();

    // Mark all pending requests as processed
    db.prepare(`
      UPDATE widget_refresh_requests
      SET processed_at = ?
      WHERE widget_slug = ? AND processed_at IS NULL
    `).run(now, slug);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error marking refresh as processed:', error);
    return NextResponse.json(
      { error: 'Failed to mark refresh as processed' },
      { status: 500 }
    );
  }
}
