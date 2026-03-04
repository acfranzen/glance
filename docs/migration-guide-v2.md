# V2 Migration Guide

## Summary
This branch introduces a compatibility-first V2 platform layer while preserving existing APIs:

- Existing endpoints remain supported: `/api/widgets`, `/api/custom-widgets`, `/api/credentials`.
- New compatibility routes are available under `/api/v2/*`.
- Contract validation is centralized and now includes semantic checks for custom widget runtime/credential/provider usage.
- New platform tables are added: `workspaces`, `executions`, `artifacts`.

## Contract Changes
Custom widget payloads now accept optional metadata:

- `required_credentials: string[]`
- `runtime_profile: "safe" | "networked"`
- `permissions: { credential_providers?: string[]; data_providers?: string[]; allow_network?: boolean }`

Semantic rules:

- Widgets using `data_providers` must set `runtime_profile: "networked"`.
- `runtime_profile: "safe"` cannot set `permissions.allow_network: true`.
- Referenced credential providers must exist in the provider registry.

## Execution Backbone
Server-code execution now flows through:

1. `ExecutionEngine` interface
2. `LegacyRuntimeExecutionAdapter` implementation
3. `executions` table recording lifecycle and outcomes

`POST /api/custom-widgets/:slug/execute` now returns `execution_id` with responses.

## Credentials UX Plumbing
`GET /api/credentials` now includes:

- `required_by_provider`: map of provider -> widget slugs
- `missing_required_providers`: provider list missing credentials

`/api/custom-widgets` and `/api/custom-widgets/:slug` include:

- `required_credentials_effective`: inferred requirement set (explicit + provider references + server code usage)

## Auth/Security Defaults
- Unauthenticated access without `AUTH_TOKEN` is now limited to local requests by default.
- Secret redaction is applied to execution and credential error/log flows.

## V2 Endpoints
Compatibility adapters:

- `/api/v2/widgets`
- `/api/v2/widgets/:id`
- `/api/v2/custom-widgets`
- `/api/v2/custom-widgets/:slug`
- `/api/v2/custom-widgets/:slug/execute`
- `/api/v2/credentials`
- `/api/v2/credentials/:id`

New platform endpoints:

- `/api/v2/workspaces`
- `/api/v2/workspaces/:id`
- `/api/v2/executions`
- `/api/v2/executions/:id`
- `/api/v2/artifacts`
- `/api/v2/artifacts/:id`
- `/api/v2/packs/publish`
- `/api/v2/packs/install`

Legacy-compatible resource endpoints currently forward to existing handlers and add `api_version: "v2"` in JSON responses.

## Security Guardrails Added

Write and execute endpoints now enforce:

- Request body size limits (route-specific thresholds)
- In-memory rate limits by client IP + method + route
- Structured 413/429 error responses

These are local-first defaults intended for single-node development; production multi-node setups should replace with shared rate-limit storage.
