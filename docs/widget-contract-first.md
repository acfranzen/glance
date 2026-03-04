# Contract-First Widget Validation

Glance now enforces strict, server-side contract validation for widget payloads before any create/update persistence and before any payload is returned for rendering.

## Scope

Validation is enforced in:

- `POST /api/widgets`
- `PATCH /api/widgets/:id`
- `POST /api/custom-widgets`
- `PATCH /api/custom-widgets/:id`
- `GET /api/widgets` and `GET /api/widgets/:id` (stored payload validation gate)
- `GET /api/custom-widgets`, `GET /api/custom-widgets/:id`, and `POST /api/custom-widgets/:id/execute` (stored payload validation gate)

Invalid payloads are rejected with HTTP `422` and structured error details.

## Structured Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid custom widget create payload",
    "details": [
      {
        "path": "$.name",
        "code": "type",
        "message": "Expected string"
      }
    ]
  }
}
```

## Required Structured Output Templates

Use these templates for AI-generated payloads. Extra fields are rejected.

### Widget Instance Template (`POST /api/widgets`)

```json
{
  "type": "claude_max_usage | custom",
  "title": "Widget title",
  "config": {},
  "position": {
    "x": 0,
    "y": 0,
    "w": 4,
    "h": 3
  },
  "data_source": {
    "type": "integration | api | static",
    "integration": "optional-provider-slug",
    "refresh_interval": 300
  },
  "custom_widget_id": "required when type=custom"
}
```

Constraints:

- `title`: 1-80 chars
- `position.x/y`: non-negative integers
- `position.w`: integer `1-12`
- `position.h`: integer `1-24`
- `data_source.refresh_interval`: integer `15-86400`

### Custom Widget Definition Template (`POST /api/custom-widgets`)

```json
{
  "name": "GitHub PRs",
  "slug": "github-prs",
  "description": "optional",
  "source_code": "function Widget() { return null; }",
  "compiled_code": null,
  "default_size": { "w": 4, "h": 3 },
  "min_size": { "w": 2, "h": 2 },
  "data_providers": ["github"],
  "refresh_interval": 300,
  "enabled": true,
  "server_code": null,
  "server_code_enabled": false
}
```

Constraints:

- `name`: 1-80 chars
- `slug`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- `source_code`/`server_code`: max 100000 chars
- `default_size.w`: `1-12`, `default_size.h`: `1-24`
- `min_size.w` cannot exceed `default_size.w`
- `min_size.h` cannot exceed `default_size.h`
- `refresh_interval`: integer `15-86400`
- `data_providers`: max 20 slug strings
- `server_code` required when `server_code_enabled=true`

## JSON Schema Source

Canonical schema objects are exported from:

- `src/lib/widget-contract.ts` as `WIDGET_CONTRACT_SCHEMAS`

## Migration Plan For Existing Invalid Widgets

1. Deploy validation in monitor mode first:
- Use `GET /api/widgets` and inspect `invalid_widgets`
- Use `GET /api/custom-widgets` and inspect `invalid_custom_widgets`

2. Inventory invalid rows and categorize:
- Broken JSON in DB fields (`config`, `position`, size fields)
- Constraint violations (size bounds, slug format, missing required fields)

Optional helper:

```bash
npm run audit:widget-contract
```

3. Repair data in place:
- Fix malformed JSON
- Normalize bounds (`w/h`, refresh interval)
- Add missing required fields (`title`, `name`, `source_code`, etc.)

4. Re-run contract checks until both invalid arrays are empty.

5. Enable strict handling in automation:
- Fail AI flows on any `422`
- Retry with corrected payload using returned `error.details`

6. Optional cleanup:
- Archive or delete unrecoverable invalid widgets.

## Rollout Notes

- Validation is backward-safe for existing valid payloads.
- Invalid stored widgets are excluded from list responses and blocked on single-resource reads/execution.
- Consumers should treat `422` as non-retryable until payload is fixed.
