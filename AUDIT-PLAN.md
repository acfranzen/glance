# Glance Documentation Audit

## Two Goals

### 1. Are the docs accurate to the code?
- Do the API endpoints documented actually exist and work as described?
- Do the code examples actually run?
- Are the component props and hooks documented correctly?
- Does the widget creation flow actually work end-to-end?

### 2. Are the docs sufficient for other OpenClaw agents?
- Can an agent read SKILL.md and successfully create a widget without guessing?
- Are the required steps clear and complete?
- Are common errors and their solutions documented?
- Is the fetch type decision clear (when to use server_code vs agent_refresh)?

---

## Audit Process

### Phase 1: Test the documented flows (1 hour)

Walk through each documented workflow and verify it works:

```bash
cd /tmp/glance-test
npm run dev
```

**Widget Creation Flow:**
1. Follow SKILL.md step-by-step to create a simple widget
2. Note any steps that are wrong, missing, or confusing
3. Verify the widget actually appears on the dashboard

**API Endpoints:**
- Test each endpoint in the API Reference section
- Verify request/response formats match documentation
- Note any undocumented parameters or behaviors

**Server Code:**
- Create a widget with server_code
- Verify `getCredential()` works as documented
- Test error handling

**Agent Refresh:**
- Create a widget with agent_refresh
- POST to cache endpoint
- Verify data appears in widget

### Phase 2: Document gaps and errors (30 min)

Create `AUDIT-FINDINGS.md` with:
- **Inaccuracies:** Where docs don't match code
- **Missing info:** Steps an agent would need but aren't documented
- **Confusing sections:** Parts that could trip up an agent

### Phase 3: Fix the docs (1-2 hours)

Priority fixes:
1. Correct any inaccurate information
2. Add missing steps or details
3. Clarify confusing sections
4. Ensure examples are copy-paste ready

### Phase 4: Verify fixes (30 min)

- Re-run the documented flows
- Confirm an agent could follow the docs successfully
- Browser verify widgets render correctly

---

## Files to Audit

| File | Purpose | Priority |
|------|---------|----------|
| `SKILL.md` | Agent quick reference | HIGH |
| `docs/widget-sdk.md` | Full SDK docs | HIGH |
| `README.md` | Overview & setup | MEDIUM |
| `docs/dashboard-api.md` | Dashboard management | LOW |

---

## Key Questions for Each Section

### For API Documentation
- Does this endpoint exist?
- Does the request format work?
- Does the response match what's documented?
- Are required headers documented?

### For Code Examples
- Does this code actually run?
- Are imports/dependencies mentioned?
- Would copy-pasting this work?

### For Workflows
- Are all steps listed?
- Is the order correct?
- What could go wrong? Is that covered?

---

## Deliverables

1. **AUDIT-FINDINGS.md** — List of issues found
2. **PR with fixes** — All documentation corrections
3. **Brief summary** — What was changed and why

---

## Success Criteria

An OpenClaw agent should be able to:
- [ ] Read SKILL.md and create a working widget on first try
- [ ] Understand when to use server_code vs agent_refresh
- [ ] Find answers to common problems in the docs
- [ ] Trust that code examples work as written

---

## Future Considerations

### Simplify to Two Fetch Types
Consider removing `webhook` as a documented pattern:
- `server_code` — Data accessible via API
- `agent_refresh` — Data NOT accessible via API (local CLI, PTY, etc.)

Webhooks still technically work (cache endpoint accepts POSTs) but may not need first-class documentation for a personal dashboard use case.
