# Platform Overhaul Plan (Vibe-Coder Edition)

## North Star
Glance should feel instant: describe a widget, run it safely, tweak it in seconds, share it as a pack.

This is not an enterprise control plane. It is a fast builder loop for solo devs and small teams that still has real contracts, security boundaries, and migration safety.

## Product Principles
- Prompt-to-widget in under 10 minutes, usually under 2.
- Contract-first, not framework-first: stable JSON contracts for widgets, connectors, and execution.
- Credentials are obvious and safe: simple UX, encrypted storage, no plaintext leaks.
- Share by default: widget packs and templates are first-class outputs.
- Guardrails over bureaucracy: deny dangerous behavior, allow fast iteration.
- No breaking surprise: existing MVP APIs keep working while v2 layers roll in.

## Current Baseline (Keep Working)
- Next.js app + `/api/*` endpoints.
- Local SQLite (`data/glance.db`) with widgets, custom widgets, credentials, providers, events.
- Contract validation in `src/lib/widget-contract.ts`.
- Widget runtime with JSX transpile + Node VM execution.
- AES-256-GCM credential encryption at rest.

## Lean Platform Model
1. `Workspace`: boundary for data, credentials, and sharing.
2. `Dashboard`: layout + widget instances.
3. `WidgetVersion`: immutable widget definition + manifest.
4. `WidgetInstance`: configured use of a widget version.
5. `ConnectorBinding`: connector config + secret refs in one workspace.
6. `Execution`: immutable run record (input, output, status, timing).
7. `Artifact`: shareable pack (widget, connector recipe, dashboard template).

Design rule: definitions are immutable/versioned; runtime state is separate.

## Simple Contracts (Hard Requirement)
### Widget manifest (v1)
- `id`, `version`, `title`, `settingsSchema`, `dataContract`, `permissions`, `runtimeProfile`.
- `runtimeProfile` initially: `safe` or `networked`.

### Connector binding (v1)
- `provider`, `operation`, `config`, `secretRefs`, `rateLimitHint`.
- Secrets referenced by key only (`secret_ref`), never embedded values.

### Execution record (v1)
- `execution_id`, `workspace_id`, `actor`, `target_type`, `target_id`, `status`, `started_at`, `finished_at`, `cost_hint`, `error`.

### Contract enforcement points
- Save time: structural validation.
- Share/install time: permission + compatibility checks.
- Run time: policy checks (runtime profile, egress, budget/time limits).

## Credential UX (Fast + Clear)
- One credential flow everywhere: `Connect -> Test -> Save -> Use`.
- Keep encrypted SQLite for local mode now.
- Introduce `SecretsProvider` interface for future KMS without changing API surface.
- Runtime gets short-lived decrypted material in memory only.
- UI always shows where a credential is used and last access timestamp.

## Execution Model (Fast Iteration First)
- Keep synchronous path for local instant feedback.
- Add queue-backed async path for retries and scheduled runs.
- Default guarantee: at-least-once with idempotency key support.
- Connector classes define retry behavior (`readonly` vs `mutating`).

## Practical Guardrails
- Default-deny secret access unless declared in manifest permissions.
- Per-connector egress allowlist.
- Runtime capability whitelist (replace weak regex-only denylist behavior).
- Auth bypass disabled by default outside localhost.
- Redact secrets in logs/errors by default.
- Request size and rate limits on write/execute endpoints.

## Shareable Widget Packs
A pack is a portable artifact with:
- Manifest + version metadata.
- Widget/connector schemas.
- Optional screenshots + README snippet.
- Permission + egress declaration.
- Provenance/signature metadata.

Install flow must show: required secrets, external domains, runtime profile, and trust level (`official`, `verified`, `community`).

## Migration Plan From MVP (No Big-Bang)
### Compatibility commitments
- Keep `/api/widgets`, `/api/custom-widgets`, `/api/credentials` functional.
- Add new APIs under `/api/v2/*`.
- Legacy widgets auto-wrap into `WidgetVersion` manifest format.

### Phased rollout
1. Contract foundation
- Add schema registry for widget/connector/execution contracts.
- Gate writes with centralized validation.

2. Metadata + execution backbone
- Add `workspaces`, `artifacts`, `executions` tables.
- Introduce `ExecutionEngine` abstraction with existing runtime adapter.

3. Connector + secrets unification
- Standardize connector binding model.
- Move usage to `secret_ref` conventions.

4. Sharing
- Add pack publish/install endpoints and compatibility checks.

5. UI migration
- Move creation/edit flows to v2 APIs.
- Keep legacy endpoints as adapter layer until parity is proven.

## 90-Day Delivery (Small-Team Scope)
### Days 0-30: Contract + Safety Baseline
- Ship schema validation gates and compatibility tests.
- Add new metadata tables and non-breaking migrations.
- Implement auth hardening and secret redaction defaults.

Exit criteria:
- Existing API tests pass unchanged.
- 95%+ writes validated by centralized contracts.
- No critical auth/secret findings in internal review.

### Days 31-60: Runtime + Connectors
- Introduce in-process queue and worker path.
- Migrate two connectors to binding model (GitHub + one usage API).
- Add execution logs with correlation IDs.

Exit criteria:
- 80%+ executions through queue path.
- Retries recover at least half of transient failures.

### Days 61-90: Packs + Multi-Workspace Beta
- Ship artifact publish/install flow.
- Enable workspace boundaries and basic roles (`owner`, `editor`, `viewer`).
- Publish migration guide for existing OpenClaw flows.

Exit criteria:
- 20+ successful internal pack installs.
- Zero cross-workspace leakage in security tests.
- Median prompt-to-running-shared-widget under 10 minutes.

## Repo Shape (Incremental)
```text
src/
  platform/
    api/
    domain/
    runtime/
    connectors/
    widgets/
    security/
    sharing/
  legacy/
    api-adapters/
    widget-runtime/
```

Rule: new architecture goes in `src/platform/*`; legacy stays until replaced.

## This Week (Implementation Kickoff)
1. Create Architecture RFC-0001 from this doc.
2. Add schema registry and first contract tests.
3. Add `workspaces`, `artifacts`, `executions` migrations.
4. Implement `ExecutionEngine` interface + adapter.
5. Flip auth bypass default to safe mode for non-local runs.
