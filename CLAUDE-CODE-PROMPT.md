# Glance Documentation Audit

Audit the Glance docs with two goals:

1. **Accuracy** — Do the docs match the actual code?
2. **Completeness** — Can another OpenClaw agent use these docs to create widgets without issues?

## Setup

```bash
cd /tmp/glance-test
npm run dev  # Start the server
```

## Phase 1: Test the Docs (1 hour)

### Test Widget Creation Flow
Follow SKILL.md exactly to create a widget. Note anything that:
- Doesn't work as written
- Is missing steps
- Would confuse an agent

### Test API Endpoints  
For each endpoint in the API Reference:
```bash
# Example: Test widget list
curl http://localhost:3333/api/widgets

# Test creating a widget (use actual example from docs)
# Does it work? Does response match docs?
```

### Test Server Code Pattern
Create a widget with `fetch.type = "server_code"`. Verify:
- `getCredential()` works
- Server code executes
- Widget displays data

### Test Agent Refresh Pattern
Create a widget with `fetch.type = "agent_refresh"`. Verify:
- POST to `/api/widgets/{slug}/cache` works
- Data appears in widget
- Instructions are clear enough to follow

## Phase 2: Document Issues (30 min)

Create `AUDIT-FINDINGS.md`:

```markdown
# Audit Findings

## Inaccuracies (docs don't match code)
- [ ] Issue 1...
- [ ] Issue 2...

## Missing Information (agent would get stuck)
- [ ] Missing step...
- [ ] Undocumented requirement...

## Confusing Sections (could be clearer)
- [ ] Section X needs...
```

## Phase 3: Fix the Docs (1-2 hours)

Fix issues in priority order:
1. Inaccuracies (wrong info is worse than missing info)
2. Missing steps that would block an agent
3. Clarity improvements

Files to update:
- `SKILL.md` (agent quick reference)
- `docs/widget-sdk.md` (full docs)
- `README.md` (if needed)

## Phase 4: Verify & Ship (30 min)

1. Re-test the flows you fixed
2. Browser verify dashboard works: http://localhost:3333
3. Commit and PR:

```bash
git checkout -b zeus/docs-audit
git add -A
git commit -m "docs: audit fixes - accuracy and completeness improvements"
git push origin zeus/docs-audit
gh pr create --title "📚 Docs audit fixes" --body "See AUDIT-FINDINGS.md"
```

## Success Criteria

After your fixes, another OpenClaw agent should be able to:
- Read SKILL.md → create a working widget on first try
- Know when to use server_code vs agent_refresh
- Find solutions to common errors
- Trust that examples work as written

## Don't
- Don't refactor code (docs only)
- Don't add features
- Don't overcomplicate — clear and accurate beats comprehensive
