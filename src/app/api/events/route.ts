import { NextRequest } from 'next/server';
import { validateAuthOrInternal } from '@/lib/auth';
import { getRecentEvents } from '@/lib/db';
import { eventClients } from '@/lib/events';

// GET /api/events - Server-Sent Events stream
export async function GET(request: NextRequest) {
  const auth = validateAuthOrInternal(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(request.url);
  const includeRecent = searchParams.get('recent') === 'true';

  const stream = new ReadableStream({
    start(controller) {
      // Add this client to the set
      eventClients.add(controller);

      // Send initial connection message
      const connected = `event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(new TextEncoder().encode(connected));

      // Optionally send recent events
      if (includeRecent) {
        const recent = getRecentEvents(10);
        for (const event of recent.reverse()) {
          const msg = `event: ${event.type}\ndata: ${JSON.stringify({
            id: event.id,
            payload: event.payload ? JSON.parse(event.payload) : null,
            timestamp: event.created_at,
          })}\n\n`;
          controller.enqueue(new TextEncoder().encode(msg));
        }
      }

      // Keep-alive ping every 30 seconds
      const pingInterval = setInterval(() => {
        try {
          const ping = `event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`;
          controller.enqueue(new TextEncoder().encode(ping));
        } catch {
          clearInterval(pingInterval);
          eventClients.delete(controller);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        clearInterval(pingInterval);
        eventClients.delete(controller);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
