# Planning Task: Dashboard Management API

## Context

Glance dashboard stores widget instances in the `widgets` table:
```sql
widgets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- "custom" for custom widgets
  title TEXT NOT NULL,
  config TEXT DEFAULT '{}',
  position TEXT DEFAULT '{}',   -- {"x":0,"y":0,"w":4,"h":3}
  custom_widget_id TEXT,        -- FK to custom_widgets.id
  mobile_position TEXT          -- separate mobile layout
)
```

Currently there's no API to manage the dashboard grid programmatically. Agents need to add/remove/rearrange widgets without using the UI.

## Requirements

### Endpoints

#### `GET /api/dashboard`
List all widget instances on the dashboard.

Response:
```json
{
  "widgets": [
    {
      "id": "instance-id",
      "type": "custom",
      "title": "Widget Name",
      "position": {"x": 0, "y": 0, "w": 4, "h": 3},
      "mobilePosition": {"x": 0, "y": 0, "w": 12, "h": 3},
      "customWidgetId": "cw_xxx",
      "customWidgetSlug": "widget-slug"  // resolved from custom_widgets
    }
  ],
  "gridCols": 12
}
```

#### `POST /api/dashboard`
Add a widget instance to the dashboard.

Request:
```json
{
  "customWidgetSlug": "calendar-weather",  // OR customWidgetId
  "title": "My Calendar",                   // optional, defaults to widget name
  "position": {"x": 0, "y": 6, "w": 4, "h": 4},  // optional, auto-place if omitted
  "mobilePosition": {"x": 0, "y": 12, "w": 12, "h": 4}  // optional
}
```

Response:
```json
{
  "success": true,
  "widget": { ...instance data... }
}
```

**Auto-placement logic:** If position omitted, find first available spot that fits the widget's default_size. Scan grid top-to-bottom, left-to-right.

#### `PATCH /api/dashboard/:instanceId`
Update a widget instance (position, title, config).

Request:
```json
{
  "title": "New Title",
  "position": {"x": 4, "y": 0, "w": 6, "h": 4},
  "mobilePosition": {"x": 0, "y": 0, "w": 12, "h": 4}
}
```

#### `DELETE /api/dashboard/:instanceId`
Remove a widget from the dashboard.

Response:
```json
{
  "success": true,
  "removed": "instance-id"
}
```

#### `PUT /api/dashboard/layout`
Bulk update all widget positions (for rearranging).

Request:
```json
{
  "layout": [
    {"id": "instance-1", "position": {"x": 0, "y": 0, "w": 4, "h": 3}},
    {"id": "instance-2", "position": {"x": 4, "y": 0, "w": 4, "h": 3}}
  ]
}
```

### Auth

Same as other widget APIs — internal requests (Origin: localhost) bypass auth, external requires token.

### Validation

- Position must have x, y, w, h (all integers >= 0)
- x + w <= 12 (grid columns)
- customWidgetSlug or customWidgetId must reference existing custom_widget
- Instance ID must exist for PATCH/DELETE

## Files to Create/Modify

1. `src/app/api/dashboard/route.ts` — GET (list), POST (add)
2. `src/app/api/dashboard/[instanceId]/route.ts` — PATCH, DELETE
3. `src/app/api/dashboard/layout/route.ts` — PUT (bulk update)
4. `src/lib/db.ts` — add helper functions:
   - `getWidgetInstances()`
   - `addWidgetInstance()`
   - `updateWidgetInstance()`
   - `removeWidgetInstance()`
   - `updateDashboardLayout()`

## Success Criteria

1. Agent can list all widgets on dashboard via API
2. Agent can add a custom widget to dashboard by slug
3. Agent can reposition/resize widgets
4. Agent can remove widgets
5. Auto-placement works when position not specified
