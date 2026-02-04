# Documentation Audit Findings

**Date:** February 4, 2026  
**Auditor:** OpenClaw subagent (zeus/docs-audit)  
**Goal:** Ensure another agent can use these docs to create widgets without issues

---

## Executive Summary

**Overall Status:** ⚠️ Needs fixes — mostly good but one critical inconsistency

The docs are generally accurate, but `docs/widget-sdk.md` has a **major endpoint inconsistency** that would break any agent following it. SKILL.md is the more accurate reference.

---

## Critical Issues

### 1. `/api/health` Endpoint Does Not Exist ❌

**Location:** SKILL.md Quick Start  
**What it says:**
```bash
curl -s "$GLANCE_URL/api/health"
```

**Actual behavior:** Returns 404 — no health endpoint exists.

**Impact:** Agent following Quick Start gets stuck immediately.

**Fix:** Remove or replace with working endpoint (`GET /api/widgets`).

---

### 2. `docs/widget-sdk.md` Uses Wrong Endpoint Paths ❌

**What it says throughout:**
- `/api/custom-widgets` — Create widget definition
- `/api/custom-widgets/:slug` — Get/update/delete widget
- `/api/custom-widgets/:slug/execute` — Execute server code
- `/api/widgets` — Add widget to dashboard (instances)

**Actual endpoints:**
- `/api/widgets` — Widget definitions (GET, POST)
- `/api/widgets/:slug` — Get/update/delete widget definition
- `/api/widgets/:slug/execute` — Execute server code
- `/api/widgets/instances` — Dashboard instances (GET, POST)
- `/api/widgets/instances/:id` — Instance CRUD

**Impact:** Agent following widget-sdk.md gets 404s on every API call.

**Fix:** Replace all `/api/custom-widgets` → `/api/widgets` throughout.

---

## Medium Issues

### 3. Auth Bypass Not Documented

**Finding:** Requests from localhost bypass auth if they include `Origin: http://localhost:3333` header.

**Current docs:** Only mention Bearer token auth.

**Impact:** Agents might struggle with auth when a simple header works.

**Fix:** Document the Origin header bypass for local development.

---

### 4. Response Format Inconsistencies in widget-sdk.md

**What it says:**
```json
{
  "id": "cw_abc123xyz",
  "name": "GitHub PRs",
  "slug": "github-prs",
  ...
}
```

**Actual:** The response structure is correct, but the endpoint to get it is wrong (see #2).

---

## Minor Issues / Suggestions

### 5. SKILL.md Is Good But Could Be Clearer

The SKILL.md is mostly accurate. Minor suggestions:
- Add explicit example of Origin header for local dev
- The cache POST example is correct but add note about schema validation

### 6. README.md Quick Start Works

The README workflow is correct:
1. `POST /api/credentials` ✓
2. `POST /api/widgets` ✓  
3. `POST /api/widgets/instances` ✓

---

## Files to Update

| File | Priority | Issue |
|------|----------|-------|
| `SKILL.md` | High | Remove `/api/health` reference |
| `docs/widget-sdk.md` | **Critical** | Fix ALL endpoint paths |
| `README.md` | Low | Already correct |

---

## Verification Tests Run

```bash
# Health endpoint (FAIL - 404)
curl http://localhost:3333/api/health

# Widget definitions (PASS)
curl -H "Origin: http://localhost:3333" http://localhost:3333/api/widgets

# Widget instances (PASS)
curl -H "Origin: http://localhost:3333" http://localhost:3333/api/widgets/instances

# Cache endpoint (PASS - with schema validation)
curl -X POST -H "Origin: http://localhost:3333" \
  -d '{"data": {...}}' \
  http://localhost:3333/api/widgets/{slug}/cache

# Documented /api/custom-widgets (FAIL - 404)
curl http://localhost:3333/api/custom-widgets
```

---

## Recommendation

1. **Immediately fix** `docs/widget-sdk.md` endpoint paths — this is the #1 blocker
2. Remove health check from SKILL.md Quick Start
3. Add note about Origin header auth bypass
4. Keep SKILL.md as the primary agent reference (it's more accurate)
