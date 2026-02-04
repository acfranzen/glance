import { NextRequest, NextResponse } from 'next/server';
import https, { type RequestOptions } from 'https';

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

    // Try to wake the OpenClaw agent if webhook is configured
    const webhookUrl = process.env.OPENCLAW_WEBHOOK_URL;
    const webhookToken = process.env.OPENCLAW_WEBHOOK_TOKEN;
    let webhookSent = false;
    
    if (webhookUrl && webhookToken) {
      try {
        const refreshInstructions = [
          `⚡ WIDGET REFRESH REQUEST: ${slug}`,
          '',
          'BEFORE spawning a subagent, you MUST read the widget config:',
          `  curl -s -H "Origin: http://localhost:3333" "http://localhost:3333/api/widgets/${slug}" | jq .fetch`,
          '',
          'The fetch.instructions field contains the EXACT commands to run.',
          'Do NOT assume or guess the data source. READ THE INSTRUCTIONS.',
        ].join('\n');

        const payload = JSON.stringify({
          tool: 'cron',
          args: {
            action: 'wake',
            text: refreshInstructions,
            mode: 'now'
          }
        });

        // Use node:https directly for better SSL control (especially for localhost)
        const url = new URL(webhookUrl);
        const isHttps = url.protocol === 'https:';
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

        const options: RequestOptions = {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${webhookToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload).toString()
          },
          timeout: 5000,
          // Allow self-signed certificates for localhost
          rejectUnauthorized: !(isHttps && isLocalhost)
        };

        const httpModule = isHttps ? https : (await import('http')).default;
        
        await new Promise<void>((resolve, reject) => {
          const req = httpModule.request(webhookUrl, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                webhookSent = true;
                resolve();
              } else {
                console.error(`OpenClaw webhook failed: ${res.statusCode} ${res.statusMessage} - ${data}`);
                resolve(); // Don't reject - fire-and-forget
              }
            });
          });

          req.on('error', (e) => {
            console.error('Failed to notify OpenClaw:', e.message);
            resolve(); // Don't reject - fire-and-forget
          });

          req.on('timeout', () => {
            req.destroy();
            console.error('OpenClaw webhook timeout');
            resolve(); // Don't reject - fire-and-forget
          });

          req.write(payload);
          req.end();
        });
      } catch (e) {
        // Fire-and-forget: Network failure or timeout won't block the request
        // Agent will pick it up on next heartbeat via the queued request
        console.error('Failed to notify OpenClaw:', e);
      }
    }

    return NextResponse.json({
      status: 'refresh_requested',
      success: true,
      webhook_sent: webhookSent,
      fallback_queued: true,
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
