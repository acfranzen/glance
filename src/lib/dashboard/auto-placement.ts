/**
 * Smart auto-placement algorithm for dashboard widgets
 *
 * Finds the first available grid position that can fit a widget of the given size,
 * scanning top-to-bottom, left-to-right. Falls back to placing at the bottom if
 * no gaps are available.
 */

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ExistingWidget {
  position: WidgetPosition;
}

/**
 * Find the first available position for a widget of the given size
 *
 * @param existingWidgets - Array of widgets with their positions
 * @param widgetSize - Size of the widget to place (w, h)
 * @param gridColumns - Number of grid columns (default: 12)
 * @returns Position where the widget can be placed
 */
export function findFirstAvailablePosition(
  existingWidgets: ExistingWidget[],
  widgetSize: { w: number; h: number },
  gridColumns: number = 12
): WidgetPosition {
  // Build occupancy set from existing widgets
  const occupied = new Set<string>();
  let maxY = 0;

  for (const widget of existingWidgets) {
    const pos = widget.position;
    for (let x = pos.x; x < pos.x + pos.w; x++) {
      for (let y = pos.y; y < pos.y + pos.h; y++) {
        occupied.add(`${x},${y}`);
      }
    }
    maxY = Math.max(maxY, pos.y + pos.h);
  }

  // If no widgets exist, place at origin
  if (existingWidgets.length === 0) {
    return { x: 0, y: 0, w: widgetSize.w, h: widgetSize.h };
  }

  // Scan grid top-to-bottom, left-to-right for first fit
  // Search up to maxY + widgetSize.h + 10 rows to find gaps
  const searchRows = maxY + widgetSize.h + 10;

  for (let y = 0; y < searchRows; y++) {
    for (let x = 0; x <= gridColumns - widgetSize.w; x++) {
      if (canPlace(x, y, widgetSize, occupied, gridColumns)) {
        return { x, y, w: widgetSize.w, h: widgetSize.h };
      }
    }
  }

  // Fallback: place at bottom-left
  return { x: 0, y: maxY, w: widgetSize.w, h: widgetSize.h };
}

/**
 * Check if a widget can be placed at the given position
 */
function canPlace(
  startX: number,
  startY: number,
  size: { w: number; h: number },
  occupied: Set<string>,
  gridColumns: number
): boolean {
  // Check if widget fits within grid columns
  if (startX + size.w > gridColumns) {
    return false;
  }

  // Check if any cell in the target area is occupied
  for (let x = startX; x < startX + size.w; x++) {
    for (let y = startY; y < startY + size.h; y++) {
      if (occupied.has(`${x},${y}`)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get the maximum Y coordinate (bottom) of all widgets
 */
export function getMaxY(existingWidgets: ExistingWidget[]): number {
  let maxY = 0;
  for (const widget of existingWidgets) {
    const pos = widget.position;
    maxY = Math.max(maxY, pos.y + pos.h);
  }
  return maxY;
}
