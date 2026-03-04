# V2 Platform Runbook

## Scope
Operational runbook for V2 platform resources:

- Workspaces
- Executions
- Artifacts / Packs
- Request guardrails

## Quick Health Checks

1. Contract audit:

```bash
npm run audit:widget-contract
```

2. API smoke checks:

```bash
curl -s http://localhost:3333/api/v2/workspaces
curl -s http://localhost:3333/api/v2/executions?limit=5
curl -s http://localhost:3333/api/v2/artifacts?limit=5
```

3. Full test/lint/build:

```bash
npm run lint
npm test
npm run build
```

## Pack Publish / Install Flow

1. Publish:

```http
POST /api/v2/packs/publish
{
  "workspace_id": "ws_default",
  "title": "GitHub PR Pack",
  "manifest": {
    "manifest_version": "v1",
    "widget_slug": "github-prs",
    "widget_version": "1.0.0",
    "runtime_profile": "networked",
    "permissions": { "allow_network": true, "credential_providers": ["github"] },
    "required_secrets": ["github"],
    "egress_domains": ["api.github.com"],
    "trust_level": "community"
  }
}
```

2. Install preview:

```http
POST /api/v2/packs/install
{
  "artifact_id": "art_xxx",
  "workspace_id": "ws_default"
}
```

Expected result includes required secrets, trust level, runtime profile, and external domains.

## Request Guardrails

Route guardrails enforce:

- `413 REQUEST_TOO_LARGE` on oversized payloads
- `429 RATE_LIMITED` when per-route burst limit is exceeded

Defaults are in-memory and reset per process restart.

## Troubleshooting

`422 VALIDATION_ERROR`:
- Use `error.details[]` path/code/message to fix payload structure.

`422 SEMANTIC_CONTRACT_ERROR`:
- Resolve runtime/profile conflicts (example: `safe` with network permissions).

`500` during server-code execution:
- Check custom widget contract validity and `required_credentials_effective`.
- Validate secrets exist through `/api/credentials`.

## Rollback

V2 endpoints are additive and legacy APIs remain intact. If needed:

1. Stop calling `/api/v2/*` from clients.
2. Continue using `/api/widgets`, `/api/custom-widgets`, `/api/credentials`.
3. Keep DB schema as-is (new tables are non-breaking).

