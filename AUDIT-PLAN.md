# Glance Documentation Audit Plan

## Mission

Audit the entire Glance codebase to ensure documentation is accurate, consistent, and reflects the correct design philosophy.

## Core Design Philosophy

**Glance is a dashboard that OpenClaw manages via API.** The widget ecosystem has three fetch types with a clear hierarchy:

### Fetch Type Hierarchy (IMPORTANT)

1. **`server_code`** (PRIMARY) — Widget's server-side code calls external APIs using credentials stored in Glance's encrypted database. This is the default and most common pattern.
   - Example: GitHub PRs widget calls GitHub API with stored PAT
   - Example: Weather widget calls OpenWeather API with stored key
   - Example: Anthropic usage widget calls Anthropic Admin API

2. **`webhook`** — External services push data to Glance's cache endpoint. Used when data is event-driven.
   - Example: Stripe pushes payment events
   - Example: GitHub webhooks for repo activity

3. **`agent_refresh`** (FALLBACK) — OpenClaw agent collects data and POSTs to cache. **Only use when data cannot be accessed via API.**
   - Example: Claude CLI `/status` (requires interactive PTY, no API exists)
   - Example: Local Homebrew package count (requires local shell access)
   - Example: iCloud calendar via icalBuddy (no API, local software only)

### Key Principle

**If there's an API for it, use `server_code`, not `agent_refresh`.** The agent_refresh pattern exists for edge cases where the data source has no API or requires local machine access.

---

## Audit Checklist

### 1. Documentation Consistency

#### Files to Audit
- [ ] `README.md` — User-facing overview
- [ ] `SKILL.md` — Agent quick reference
- [ ] `docs/widget-sdk.md` — Full SDK documentation
- [ ] `docs/dashboard-api.md` — Dashboard management API
- [ ] Any other `.md` files in `docs/`

#### Check For
- [ ] Consistent fetch type hierarchy (server_code > webhook > agent_refresh)
- [ ] No language suggesting agent_refresh is primary or preferred
- [ ] Clear explanation of when to use each fetch type
- [ ] Decision trees/flowcharts match the hierarchy
- [ ] Examples use appropriate fetch types (GitHub = server_code, not agent_refresh)

### 2. Code Examples Audit

#### In All Documentation
- [ ] Widget creation examples default to `server_code` pattern
- [ ] `agent_refresh` examples are clearly marked as "for edge cases" or "when no API exists"
- [ ] Credential management examples show server_code flow
- [ ] No examples incorrectly use agent_refresh for API-accessible data

### 3. SKILL.md Specific Audit

#### Current Issues to Fix
- [ ] Remove or reduce emphasis on agent_refresh as the main pattern
- [ ] Update "Fetch Type Decision Tree" to prioritize server_code
- [ ] Update "Most widgets should use agent_refresh" — this is WRONG
- [ ] Ensure Quick Start shows server_code pattern first
- [ ] Agent Refresh Contract section should emphasize it's a fallback

#### Restructure To
1. Quick Start → server_code example (e.g., GitHub PRs)
2. Fetch Types → clear hierarchy with server_code first
3. Server Code section → expanded, primary documentation
4. Webhook section → secondary
5. Agent Refresh section → clearly marked as fallback for edge cases

### 4. widget-sdk.md Specific Audit

#### Check
- [ ] "Fetch Type Decision Tree" matches hierarchy
- [ ] "When to Use Server Code" section exists and is prominent
- [ ] agent_refresh documentation clearly states it's for edge cases
- [ ] Examples section shows server_code widgets first
- [ ] OpenClaw Integration Guide reflects correct hierarchy

### 5. README.md Specific Audit

#### Check
- [ ] "How It Works" section implies correct architecture
- [ ] "AI Agents: Start Here" TL;DR shows server_code flow
- [ ] Feature descriptions don't overemphasize agent collection
- [ ] API Reference table is complete and accurate

### 6. Code Audit (verify docs match implementation)

#### Files to Check
- [ ] `src/app/api/widgets/route.ts` — Widget definition API
- [ ] `src/app/api/widgets/[slug]/cache/route.ts` — Cache endpoint
- [ ] `src/app/api/widgets/[slug]/execute/route.ts` — Server code execution
- [ ] `src/app/api/credentials/route.ts` — Credential management
- [ ] `src/lib/widget-executor.ts` — Server code VM
- [ ] `src/components/CustomWidgetWrapper.tsx` — Widget rendering

#### Verify
- [ ] Server code execution actually works as documented
- [ ] `getCredential()` function works in server code VM
- [ ] Cache endpoint validates against data_schema
- [ ] Webhook refresh flow works as documented

### 7. Existing Widgets Audit

#### Check All Custom Widgets in Database
- [ ] Which fetch type does each use?
- [ ] Are any using agent_refresh when server_code would work?
- [ ] Document which widgets legitimately need agent_refresh

#### Current Widgets (audit these)
- `claude-code-usage` — agent_refresh ✓ (no API, requires PTY)
- `open-prs` — Should this be server_code? (GitHub API exists)
- `recent-emails` — Should this be server_code? (Gmail API exists via gog/OAuth)
- `calendar-weather` — agent_refresh ✓ (icalBuddy has no API, wttr.in could be server_code)

---

## Deliverables

### 1. Issue Report
Create a list of all inconsistencies found, categorized by file.

### 2. Fix PRs
- PR 1: SKILL.md restructure (flip hierarchy, fix examples)
- PR 2: widget-sdk.md updates (same hierarchy fixes)
- PR 3: README.md tweaks (if needed)
- PR 4: Widget migrations (move any widgets from agent_refresh to server_code where appropriate)

### 3. Summary Document
Write a brief summary of changes made and rationale.

---

## Execution Notes

### For Claude Code / Coding Agent

1. **Read all documentation first** before making changes
2. **Create a branch** `zeus/docs-audit` or similar
3. **Make atomic commits** — one logical change per commit
4. **Test any code changes** — run the dev server, verify widgets work
5. **Browser verify** — check the dashboard renders correctly after changes

### Time Estimate
- Documentation audit: 30-60 minutes
- Fixes: 1-2 hours
- Testing: 30 minutes
- Total: ~2-3 hours

### Commands to Start

```bash
cd /tmp/glance-test
git checkout main && git pull
git checkout -b zeus/docs-audit

# Read the docs first
cat README.md
cat SKILL.md
cat docs/widget-sdk.md

# Check existing widgets
sqlite3 data/glance.db "SELECT slug, json_extract(fetch, '$.type') FROM custom_widgets"

# Start dev server for testing
npm run dev
```

---

## Success Criteria

After the audit:
1. All documentation consistently presents server_code as the primary pattern
2. agent_refresh is clearly positioned as a fallback for edge cases
3. Decision trees and examples match the hierarchy
4. No contradictions between README, SKILL.md, and widget-sdk.md
5. Existing widgets use appropriate fetch types
