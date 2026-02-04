# Glance Documentation Audit Task

You are auditing the Glance dashboard project to ensure documentation accuracy and consistency.

## Context

Glance is a dashboard skill for OpenClaw. Widgets can fetch data in three ways:

1. **server_code** (PRIMARY) — Widget's server-side JS calls external APIs using credentials stored in Glance
2. **webhook** — External services push data to cache
3. **agent_refresh** (FALLBACK) — OpenClaw agent manually collects data. **Only for data with no API** (e.g., CLI tools, PTY sessions)

**CRITICAL**: The current docs incorrectly emphasize `agent_refresh` as the main pattern. It should be a fallback. Fix this throughout.

## Your Task

### Phase 1: Read & Understand (15 min)
```bash
cd /tmp/glance-test
cat README.md
cat SKILL.md  
cat docs/widget-sdk.md
cat AUDIT-PLAN.md  # Detailed checklist
```

### Phase 2: Audit & Document Issues (30 min)
Create `AUDIT-FINDINGS.md` listing every inconsistency:
- Places where agent_refresh is presented as primary
- Incorrect decision trees
- Misleading examples
- Missing server_code documentation

### Phase 3: Fix Documentation (1-2 hours)

#### SKILL.md Priority Fixes:
1. Change "Most widgets should use agent_refresh" → "Most widgets should use server_code"
2. Update Fetch Type Decision Tree — server_code first
3. Add prominent "Server Code Pattern" section
4. Relabel agent_refresh section as "Fallback: Agent Refresh"
5. Update Quick Start to show server_code example

#### widget-sdk.md Priority Fixes:
1. Update decision tree hierarchy
2. Expand server_code documentation  
3. Add "When to Use Each Fetch Type" section with clear criteria
4. Update examples to default to server_code

#### README.md (light touch):
1. Update "AI Agents: Start Here" TL;DR if needed
2. Ensure no misleading statements about agent_refresh

### Phase 4: Verify Existing Widgets (20 min)
```bash
sqlite3 data/glance.db "SELECT slug, json_extract(fetch, '$.type') as type FROM custom_widgets"
```

For each widget using agent_refresh, determine if it could use server_code instead:
- `open-prs` — GitHub API exists, could be server_code
- `recent-emails` — Gmail API exists, could be server_code (needs OAuth)
- `claude-code-usage` — No API, must stay agent_refresh ✓
- `calendar-weather` — icalBuddy has no API, agent_refresh needed ✓

Document findings. Optionally migrate widgets if straightforward.

### Phase 5: Test & Commit (30 min)
```bash
npm run dev  # Start server
# Open http://localhost:3333 and verify widgets work

git add -A
git commit -m "docs: audit and fix fetch type hierarchy

- Position server_code as primary pattern
- Relabel agent_refresh as fallback for edge cases
- Update decision trees and examples
- Fix misleading statements throughout"

git push origin zeus/docs-audit
gh pr create --title "📚 Docs audit: Fix fetch type hierarchy" --body "See AUDIT-FINDINGS.md for details"
```

## Key Files
- `/tmp/glance-test/SKILL.md`
- `/tmp/glance-test/docs/widget-sdk.md`
- `/tmp/glance-test/README.md`
- `/tmp/glance-test/AUDIT-PLAN.md` (detailed checklist)

## Success Criteria
- [ ] server_code is clearly the primary/default pattern
- [ ] agent_refresh is clearly a fallback for edge cases
- [ ] Decision trees updated in both SKILL.md and widget-sdk.md
- [ ] No contradictions between docs
- [ ] PR created with all changes

## Don't
- Don't break working code
- Don't remove agent_refresh docs entirely (it's still valid for edge cases)
- Don't make the docs overly complex
- Don't forget to test that the dashboard still works

Start by reading AUDIT-PLAN.md for the full checklist, then proceed.
