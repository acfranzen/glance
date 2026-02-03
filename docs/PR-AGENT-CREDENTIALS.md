# PR Plan: Agent Credential Types & Fetch Instructions

## Problem

Currently, `agent_refresh` widgets show "No credentials required" even when they depend on external tools the agent must have (like `gh` CLI). Users importing these widgets don't know:

1. What tools/auth the agent needs (e.g., "GitHub CLI authenticated")
2. What command the agent should run to populate data
3. The difference between Glance-stored credentials vs agent-side requirements

## Solution

Add a new credential type `"agent"` to distinguish agent-side requirements from Glance-stored secrets.

### Credential Type Taxonomy

| Type | Storage | Example | UI Display |
|------|---------|---------|------------|
| `api_key` | Glance database (encrypted) | GitHub PAT, OpenWeather key | "API Key: Configured ✓" |
| `local_software` | Agent's machine | Homebrew, Docker | "Software: Installed ✓" |
| `oauth` | Glance database | Google Calendar token | "OAuth: Connected ✓" |
| **`agent`** (NEW) | Agent environment | `gh` CLI auth, `gcloud` auth | "Agent: gh CLI authenticated" |

## Changes Required

### 1. Type Definitions (`src/lib/db.ts`)

```typescript
export interface CredentialRequirement {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent"; // Add "agent"
  name: string;
  description: string;
  info?: string;
  
  // For api_key
  obtain_url?: string;
  obtain_instructions?: string;
  required_scopes?: string[];
  validation?: { ... };
  
  // For local_software
  check_command?: string;
  install_url?: string;
  install_instructions?: string;
  
  // For agent (NEW)
  agent_tool?: string;           // e.g., "gh", "gcloud", "aws"
  agent_auth_check?: string;     // Command to verify auth: "gh auth status"
  agent_auth_instructions?: string; // How to authenticate
}
```

**Files:** `src/lib/db.ts`

### 2. Import Route Credential Status (`src/app/api/widgets/import/route.ts`)

Update `CredentialStatus` interface and checking logic:

```typescript
interface CredentialStatus {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent";
  name: string;
  status: "configured" | "missing" | "installed" | "not_installed" | "agent_required";
  // ... existing fields
  agent_tool?: string;
  agent_auth_check?: string;
}

// In credential checking logic:
if (cred.type === "agent") {
  // Agent credentials can't be verified by Glance
  // Just flag them as "agent_required" for the user to verify
  status = "agent_required";
}
```

**Files:** `src/app/api/widgets/import/route.ts`

### 3. Widget Info Modal (`src/components/dashboard/WidgetInfoModal.tsx`)

Update UI to show agent credentials distinctly:

```tsx
// In credentials section rendering:
{cred.type === 'agent' ? (
  <div className="flex items-center gap-2">
    <Bot className="h-4 w-4 text-purple-500" />
    <span>Agent: {cred.name}</span>
    <span className="text-xs text-muted-foreground">
      (requires {cred.agent_tool} on OpenClaw agent)
    </span>
  </div>
) : (
  // Existing api_key / local_software rendering
)}
```

**Files:** 
- `src/components/dashboard/WidgetInfoModal.tsx`
- `src/components/dashboard/WidgetAboutModal.tsx`

### 4. Widget SDK Docs (`docs/widget-sdk.md`)

Add documentation for agent credential type:

```markdown
### Agent Credentials

For widgets using `agent_refresh`, you may need tools/auth that exist
on the OpenClaw agent's machine rather than stored in Glance:

| Credential Type | Where It Lives | Example |
|-----------------|----------------|---------|
| `api_key` | Glance (encrypted) | GitHub PAT |
| `agent` | Agent environment | `gh` CLI authenticated |

**Example: GitHub PRs via gh CLI**

```json
{
  "credentials": [
    {
      "id": "github_cli",
      "type": "agent",
      "name": "GitHub CLI",
      "description": "Agent needs gh CLI authenticated to GitHub",
      "agent_tool": "gh",
      "agent_auth_check": "gh auth status",
      "agent_auth_instructions": "Run `gh auth login` on the agent machine"
    }
  ],
  "fetch": {
    "type": "agent_refresh",
    "instructions": "Run `gh pr list --repo owner/repo --json ...` and POST to cache",
    "schedule": "*/30 * * * *"
  }
}
```
```

**Files:** `docs/widget-sdk.md`

### 5. Widget Package Validation (`src/lib/widget-package.ts`)

Update validation to accept `"agent"` type:

```typescript
const VALID_CREDENTIAL_TYPES = ["api_key", "local_software", "oauth", "agent"];

// In validateWidgetPackage():
if (!VALID_CREDENTIAL_TYPES.includes(cred.type)) {
  errors.push(`Invalid credential type: ${cred.type}`);
}
```

**Files:** `src/lib/widget-package.ts`

### 6. Import Response Enhancement

When importing a widget with agent credentials, include clear messaging:

```json
{
  "valid": true,
  "ready_to_import": true,
  "status": {
    "credentials": [
      {
        "id": "github_cli",
        "type": "agent",
        "name": "GitHub CLI",
        "status": "agent_required",
        "description": "OpenClaw agent must have gh CLI authenticated"
      }
    ]
  },
  "blocking_issues": [],
  "warnings": [
    "This widget requires GitHub CLI (gh) authenticated on your OpenClaw agent"
  ],
  "message": "Widget can be imported. Note: Requires gh CLI on agent."
}
```

**Files:** `src/app/api/widgets/import/route.ts`

## Migration

No database migration needed — `credentials` is stored as JSON text, so new fields are automatically supported.

## Files to Modify (Summary)

| File | Change |
|------|--------|
| `src/lib/db.ts` | Add `"agent"` to CredentialRequirement type |
| `src/lib/widget-package.ts` | Update validation for new type |
| `src/app/api/widgets/import/route.ts` | Handle agent credential checking |
| `src/app/api/widgets/[slug]/route.ts` | Include agent creds in widget info response |
| `src/components/dashboard/WidgetInfoModal.tsx` | Display agent credentials distinctly |
| `src/components/dashboard/WidgetAboutModal.tsx` | Show agent requirements in about modal |
| `docs/widget-sdk.md` | Document agent credential type |

## Testing

1. Create a widget with `type: "agent"` credential
2. Export it as a package
3. Import on fresh instance — verify warning shown
4. Check Widget Info modal shows agent requirement correctly

## Example: Fixing Open PRs Widget

Current (wrong):
```json
{
  "credentials": [],
  "fetch": { "type": "agent_refresh" }
}
```

Fixed:
```json
{
  "credentials": [
    {
      "id": "github_cli",
      "type": "agent",
      "name": "GitHub CLI",
      "description": "OpenClaw agent needs `gh` CLI authenticated",
      "agent_tool": "gh",
      "agent_auth_check": "gh auth status",
      "agent_auth_instructions": "Run `gh auth login` on the machine running OpenClaw"
    }
  ],
  "fetch": {
    "type": "agent_refresh",
    "instructions": "Run `gh pr list --repo acfranzen/libra --repo acfranzen/glance --json number,title,author,url,createdAt,isDraft` and POST results to /api/widgets/open-prs/cache",
    "schedule": "*/30 * * * *"
  }
}
```
