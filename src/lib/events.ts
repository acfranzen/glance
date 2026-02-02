// Event streaming utilities for real-time updates

// Set of connected SSE clients
export const eventClients = new Set<ReadableStreamDefaultController>();

/**
 * Broadcast an event to all connected clients
 */
export function broadcastEvent(type: string, payload: unknown) {
  const message = `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
  const encoded = new TextEncoder().encode(message);

  for (const client of eventClients) {
    try {
      client.enqueue(encoded);
    } catch {
      // Client disconnected, remove from set
      eventClients.delete(client);
    }
  }
}

/**
 * Broadcast a widget data update
 */
export function broadcastWidgetUpdate(widgetId: string, data: unknown) {
  broadcastEvent('widget_data', { widget_id: widgetId, data, timestamp: new Date().toISOString() });
}

/**
 * Broadcast a layout change
 */
export function broadcastLayoutChange(layout: unknown) {
  broadcastEvent('layout_change', { layout, timestamp: new Date().toISOString() });
}
