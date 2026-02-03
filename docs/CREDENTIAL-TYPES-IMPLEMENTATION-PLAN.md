# Implementation Plan: Credential Type Distinction for Glance Widgets

## Problem Statement

Currently, `agent_refresh` widgets display "No credentials required" in the UI even when they require external tools or authentication that the OpenClaw agent needs (e.g., `gh` CLI with authenticated GitHub session). This creates confusion because:

1. Users see "No credentials required ✓" but the widget won't work without proper agent setup
2. There's no way to document what the agent needs to successfully refresh data
3. Import validation can't check for agent-side requirements

## Proposed Solution

Introduce a **credential source distinction**:

| Type | Storage | Description | Example |
|------|---------|-------------|---------|
| `"stored"` | Glance database | Secrets managed by Glance (encrypted API keys, tokens) | OpenWeather API key, Anthropic Admin key |
| `"agent"` | External | Tools/auth the OpenClaw agent needs in its environment | `gh` CLI, authenticated browser sessions |

Additionally, add a `fetch.instructions` field specifically for `agent_refresh` widgets to document what command to run and expected data shape.

---

## Files to Modify

### 1. TypeScript Types

#### `src/lib/db.ts`
**Changes:**
- Update `CredentialRequirement` interface to add optional `source` field
- Add new type union for credential source

```typescript
// Add new type
export type CredentialSource = "stored" | "agent";

// Update CredentialRequirement interface
export interface CredentialRequirement {
  id: string;
  type: "api_key" | "local_software" | "oauth";
  source?: CredentialSource;  // NEW: defaults to "stored" for backward compatibility
  name: string;
  description: string;
  info?: string;
  // For api_key (stored credentials)
  obtain_url?: string;
  obtain_instructions?: string;
  required_scopes?: string[];
  validation?: {
    url: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    auth_header?: string;
  };
  // For local_software
  check_command?: string;
  install_url?: string;
  install_instructions?: string;
  // NEW: For agent credentials
  agent_setup_instructions?: string;  // How the agent should configure this
  agent_check_command?: string;       // Command for agent to verify it's configured
}
```

#### `src/lib/widget-package.ts`
**Changes:**
- Re-export the `CredentialSource` type
- Types are already re-exported from db.ts, no additional changes needed

#### `src/types/widget.ts` (if applicable)
- No changes needed - types flow from db.ts

---

### 2. Database Schema

#### `src/lib/db.ts` - Schema Section
**No schema changes required!**

The `credentials` column in `custom_widgets` table stores JSON. The new `source` field will be part of the serialized `CredentialRequirement[]` array. Existing widgets will have `source: undefined` which we'll treat as `"stored"` for backward compatibility.

**Migration strategy:** None needed - JSON columns are schema-flexible.

---

### 3. API Changes

#### `src/app/api/widgets/route.ts` (POST - create widget)
**Changes:**
- Accept and validate `source` field in credentials array
- Default to `"stored"` if not provided

```typescript
// In POST handler, validation section
const credentials: CredentialRequirement[] = Array.isArray(body.credentials)
  ? body.credentials.map(cred => ({
      ...cred,
      source: cred.source || "stored",  // Default to stored
    }))
  : [];
```

#### `src/app/api/widgets/[slug]/route.ts` (PATCH - update widget)
**Changes:**
- Same validation for credentials in update path

#### `src/app/api/widgets/import/route.ts`
**Changes:**
- Update `checkCredentials()` function to handle `source: "agent"` differently
- Agent credentials should show as "info" rather than "missing" - they can't be configured via Glance UI
- Update `CredentialStatus` interface

```typescript
// Update CredentialStatus interface
interface CredentialStatus {
  id: string;
  type: 'api_key' | 'local_software' | 'oauth';
  source: 'stored' | 'agent';  // NEW
  name: string;
  status: 'configured' | 'missing' | 'installed' | 'not_installed' | 'agent_required';  // NEW status
  description: string;
  // ... existing fields
  agent_setup_instructions?: string;  // NEW
  agent_check_command?: string;       // NEW
}

// Update checkCredentials function
async function checkCredentials(
  credentials: CredentialRequirement[],
): Promise<CredentialStatus[]> {
  const statuses: CredentialStatus[] = [];

  for (const cred of credentials) {
    const source = cred.source || 'stored';
    
    if (source === 'agent') {
      // Agent credentials - can't be validated via Glance
      statuses.push({
        id: cred.id,
        type: cred.type,
        source: 'agent',
        name: cred.name,
        status: 'agent_required',  // Special status for agent creds
        description: cred.description,
        agent_setup_instructions: cred.agent_setup_instructions,
        agent_check_command: cred.agent_check_command,
      });
    } else if (cred.type === "api_key" || cred.type === "oauth") {
      // ... existing logic for stored credentials
    }
    // ... rest of function
  }
  return statuses;
}
```

#### `src/app/api/widgets/[slug]/export/route.ts`
**No changes needed** - credentials array is already serialized as-is.

---

### 4. UI Component Changes

#### `src/components/dashboard/WidgetInfoModal.tsx`

**Major changes needed:**

1. **Update `CredentialInfo` interface:**
```typescript
interface CredentialInfo {
  id: string;
  type: 'api_key' | 'local_software' | 'oauth';
  source?: 'stored' | 'agent';  // NEW
  name: string;
  description?: string;
  obtain_url?: string;
  install_url?: string;
  check_command?: string;
  agent_setup_instructions?: string;  // NEW
  agent_check_command?: string;        // NEW
}
```

2. **Update Credentials Section rendering:**

```tsx
{/* 2. CREDENTIALS */}
<Section 
  title="Credentials" 
  icon={Key} 
  id="credentials"
  badge={/* updated badge logic */}
>
  {info.credentials && info.credentials.length > 0 ? (
    <div className="space-y-3">
      {/* Stored Credentials */}
      {info.credentials.filter(c => (c.source || 'stored') === 'stored').length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            Stored Credentials
          </div>
          {info.credentials
            .filter(c => (c.source || 'stored') === 'stored')
            .map((cred) => (
              // ... existing credential card rendering
            ))}
        </div>
      )}
      
      {/* Agent Credentials */}
      {info.credentials.filter(c => c.source === 'agent').length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Bot className="h-3 w-3" />
            Agent Requirements
          </div>
          {info.credentials
            .filter(c => c.source === 'agent')
            .map((cred) => (
              <div key={cred.id} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{cred.name}</div>
                    <div className="text-xs text-blue-400 mt-0.5">
                      🤖 Required by OpenClaw agent
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400">
                    <Bot className="h-3 w-3" />
                    Agent
                  </span>
                </div>
                {cred.description && (
                  <p className="text-xs text-muted-foreground">{cred.description}</p>
                )}
                {cred.agent_setup_instructions && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-400 hover:underline font-medium">
                      View setup instructions
                    </summary>
                    <pre className="mt-2 bg-secondary/50 p-3 rounded overflow-auto max-h-32 text-[11px] whitespace-pre-wrap font-mono">
                      {cred.agent_setup_instructions}
                    </pre>
                  </details>
                )}
                {cred.agent_check_command && (
                  <div className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded">
                    $ {cred.agent_check_command}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  ) : (
    <p className="text-muted-foreground text-center py-2">No credentials required ✓</p>
  )}
</Section>
```

3. **Update badge logic:**
```typescript
const storedCredentials = info?.credentials?.filter(c => (c.source || 'stored') === 'stored') ?? [];
const agentCredentials = info?.credentials?.filter(c => c.source === 'agent') ?? [];
const allStoredConfigured = storedCredentials.every(c => credentialStatus[c.id]);

// Badge shows:
// - "✓ Ready" if no credentials at all, or all stored are configured
// - "N missing" for missing stored credentials
// - "N agent" if only agent credentials exist
```

#### `src/components/dashboard/CredentialsModal.tsx`
**Changes:**
- Only show "Stored Credentials" section header
- Add informational note that some widgets may require agent-side credentials
- No need to display agent credentials here (they're not manageable via UI)

#### `src/components/dashboard/CredentialSetupWizard.tsx`
**Changes:**
- Filter to only show `source !== 'agent'` credentials
- Add skip/info for agent credentials if present in the list
- Show informational message about agent credentials at the end

```typescript
// In component
const configurableCredentials = credentials.filter(c => c.source !== 'agent');
const agentCredentials = credentials.filter(c => c.source === 'agent');

// Before "All Credentials Configured" screen, show agent info if any
{agentCredentials.length > 0 && (
  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-4">
    <h4 className="text-sm font-medium text-blue-400 mb-2">
      Agent Requirements
    </h4>
    <p className="text-xs text-muted-foreground mb-2">
      This widget also requires the following to be configured in your OpenClaw agent environment:
    </p>
    <ul className="text-sm space-y-1">
      {agentCredentials.map(cred => (
        <li key={cred.id} className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-blue-400" />
          {cred.name}
        </li>
      ))}
    </ul>
  </div>
)}
```

#### `src/components/dashboard/WidgetImportModal.tsx`
**Changes:**
- Update `CredentialStatus` type to include `source`
- Update Requirements Summary grid to show both types separately
- Show agent credentials info in preview step

```tsx
{/* In Requirements Summary grid */}
<div className="border rounded-lg p-3">
  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
    <Key className="w-4 h-4" />
    Stored Credentials
  </div>
  <div className="text-lg font-semibold">
    {validationResult.status?.credentials?.filter(c => c.source !== 'agent').length || 0}
  </div>
  {/* status indicator */}
</div>
<div className="border rounded-lg p-3">
  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
    <Bot className="w-4 h-4" />
    Agent Requirements
  </div>
  <div className="text-lg font-semibold">
    {validationResult.status?.credentials?.filter(c => c.source === 'agent').length || 0}
  </div>
</div>
```

#### `src/components/dashboard/WidgetAboutModal.tsx`
**No changes needed** - this is a simple info modal.

---

### 5. Fetch Instructions Enhancement

#### `src/lib/db.ts` - `FetchConfig` interface
**Add `instructions` documentation:**

```typescript
export interface FetchConfig {
  type: "server_code" | "webhook" | "agent_refresh";
  info?: string;                       // AI agent context for data fetching
  // For webhook
  webhook_path?: string;
  webhook_setup_instructions?: string;
  // For agent_refresh
  instructions?: string;               // Markdown instructions for the agent (already exists!)
  expected_freshness_seconds?: number;
  max_staleness_seconds?: number;
  schedule?: string;
  // NEW: Structured instruction format for programmatic parsing
  refresh_command?: string;            // The command the agent should run
  expected_data_schema?: string;       // JSON schema or TypeScript interface as string
}
```

The `instructions` field already exists! We just need to:
1. Document it better in widget-sdk.md
2. Add optional `refresh_command` and `expected_data_schema` for more structured instructions

#### `src/components/dashboard/WidgetInfoModal.tsx` - Data Fetching Section
**Update to show agent instructions prominently:**

```tsx
{info.fetch?.type === 'agent_refresh' && (
  <>
    <p>OpenClaw periodically runs a command to refresh the data.</p>
    {info.fetch.refresh_command && (
      <div className="font-mono bg-secondary/50 px-2 py-1 rounded mt-2">
        $ {info.fetch.refresh_command}
      </div>
    )}
    {info.fetch.instructions && (
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-primary hover:underline font-medium">
          View agent instructions
        </summary>
        <div className="mt-2 bg-secondary/50 p-3 rounded overflow-auto max-h-48 prose prose-invert prose-xs">
          {/* Render markdown */}
          <pre className="whitespace-pre-wrap">{info.fetch.instructions}</pre>
        </div>
      </details>
    )}
    {info.fetch.expected_data_schema && (
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-primary hover:underline font-medium">
          Expected data format
        </summary>
        <pre className="mt-2 bg-secondary/50 p-3 rounded overflow-auto max-h-32 text-[11px] font-mono">
          {info.fetch.expected_data_schema}
        </pre>
      </details>
    )}
  </>
)}
```

---

### 6. Widget Package Updates

#### `src/lib/widget-package.ts`

**No structural changes needed** - the package format already includes `credentials` array and `fetch` config. The new fields will be automatically included when present.

**Update validation:**
```typescript
// In validateWidgetPackage()
if (pkg.credentials) {
  for (const cred of pkg.credentials) {
    // ... existing validation
    
    // Validate source if present
    if (cred.source && !["stored", "agent"].includes(cred.source)) {
      errors.push(`Credential ${cred.id} has invalid source: ${cred.source}`);
    }
    
    // Warn if agent credential lacks setup instructions
    if (cred.source === "agent" && !cred.agent_setup_instructions) {
      warnings.push(`Agent credential ${cred.id} should have agent_setup_instructions`);
    }
  }
}

// Validate fetch instructions for agent_refresh
if (pkg.fetch?.type === "agent_refresh") {
  if (!pkg.fetch.instructions && !pkg.fetch.refresh_command) {
    warnings.push("agent_refresh should have instructions or refresh_command for the agent");
  }
}
```

---

### 7. Documentation Updates

#### `docs/widget-sdk.md`

**Add new section: "Credential Types"**

```markdown
## Credential Types

Widgets can require two types of credentials:

### Stored Credentials (source: "stored")

API keys and tokens stored securely in Glance's encrypted database. These are:
- Configured via the Glance Credentials modal
- Accessible in server code via `getCredential()`
- Validated before use

Example:
```json
{
  "id": "openweather",
  "type": "api_key",
  "source": "stored",
  "name": "OpenWeather API Key",
  "description": "API key for weather data",
  "obtain_url": "https://openweathermap.org/api"
}
```

### Agent Credentials (source: "agent")

External tools or authentication that the OpenClaw agent needs in its environment. These are:
- NOT stored in Glance
- Configured by the agent operator (e.g., `gh auth login`)
- Used by the agent when running refresh commands

Example:
```json
{
  "id": "gh-cli",
  "type": "local_software",
  "source": "agent",
  "name": "GitHub CLI",
  "description": "Authenticated gh CLI for fetching PR data",
  "agent_setup_instructions": "Run `gh auth login` and authenticate with your GitHub account",
  "agent_check_command": "gh auth status"
}
```

### When to Use Each

| Scenario | Source | Why |
|----------|--------|-----|
| Widget makes API calls in server code | `stored` | Glance needs the token to make requests |
| Agent runs CLI commands to fetch data | `agent` | Agent needs the tool, not Glance |
| OAuth token used by server code | `stored` | Server needs token for API calls |
| Authenticated browser session | `agent` | Agent controls the browser |
```

**Update "Agent Refresh" section:**

```markdown
### Agent Refresh Widgets

For widgets where data is fetched by the OpenClaw agent:

```json
{
  "fetch": {
    "type": "agent_refresh",
    "instructions": "Run `gh pr list --repo {owner}/{repo} --json number,title,author,state` and POST the result to `/api/widgets/{slug}/cache`",
    "refresh_command": "gh pr list --repo {owner}/{repo} --json number,title,author,state",
    "expected_data_schema": "Array<{ number: number, title: string, author: { login: string }, state: string }>",
    "schedule": "*/5 * * * *"
  },
  "credentials": [
    {
      "id": "gh-cli",
      "type": "local_software", 
      "source": "agent",
      "name": "GitHub CLI (authenticated)",
      "description": "The gh CLI must be installed and authenticated",
      "agent_setup_instructions": "1. Install: brew install gh\n2. Authenticate: gh auth login\n3. Verify: gh auth status",
      "agent_check_command": "gh auth status"
    }
  ]
}
```

**Fields:**
- `instructions`: Human-readable instructions for the agent (supports markdown)
- `refresh_command`: The specific command to run (for programmatic use)
- `expected_data_schema`: TypeScript interface or JSON schema describing expected output
- `schedule`: Cron expression for automatic refresh
```

---

## Migration Notes

### Backward Compatibility

1. **Existing widgets:** `source` field will be `undefined`, treated as `"stored"`
2. **Existing packages:** Import will work unchanged; credentials default to `"stored"`
3. **UI:** Shows existing credentials in "Stored Credentials" section by default

### No Database Migration Required

The `credentials` column stores JSON arrays. The new `source` field is optional and backward-compatible.

---

## Implementation Order

1. **Phase 1: Types** (no breaking changes)
   - Add `CredentialSource` type to `src/lib/db.ts`
   - Add `source` field to `CredentialRequirement`
   - Add new fields to `FetchConfig`

2. **Phase 2: API** 
   - Update import route to handle `source: "agent"` credentials
   - Add new `CredentialStatus` values

3. **Phase 3: UI**
   - Update `WidgetInfoModal.tsx` to display both credential types
   - Update `CredentialSetupWizard.tsx` to skip agent credentials
   - Update `WidgetImportModal.tsx` preview

4. **Phase 4: Documentation**
   - Update `widget-sdk.md`
   - Add examples in comments

5. **Phase 5: Validation**
   - Update `validateWidgetPackage()` with new checks
   - Add warnings for missing agent instructions

---

## Example: GitHub PRs Widget (agent_refresh)

```json
{
  "version": 1,
  "type": "glance-widget",
  "meta": {
    "name": "GitHub PRs",
    "slug": "github-prs-agent",
    "description": "Shows open PRs using gh CLI"
  },
  "widget": {
    "source_code": "...",
    "server_code_enabled": false,
    "default_size": { "w": 4, "h": 3 },
    "min_size": { "w": 2, "h": 2 },
    "refresh_interval": 300
  },
  "credentials": [
    {
      "id": "gh-cli",
      "type": "local_software",
      "source": "agent",
      "name": "GitHub CLI",
      "description": "Authenticated GitHub CLI for fetching PR data",
      "agent_setup_instructions": "Install gh CLI and authenticate:\n\n```bash\nbrew install gh\ngh auth login\n```\n\nVerify with `gh auth status`",
      "agent_check_command": "gh auth status"
    }
  ],
  "fetch": {
    "type": "agent_refresh",
    "instructions": "Fetch open PRs and POST to cache:\n\n```bash\ngh pr list --repo {config.owner}/{config.repo} --state open --json number,title,author,state,url,createdAt\n```\n\nPOST result to `/api/widgets/github-prs-agent/cache`",
    "refresh_command": "gh pr list --repo {owner}/{repo} --state open --json number,title,author,state,url,createdAt",
    "expected_data_schema": "Array<{ number: number, title: string, author: { login: string }, state: string, url: string, createdAt: string }>",
    "schedule": "*/5 * * * *"
  }
}
```

---

## Summary of Changes

| File | Type | Changes |
|------|------|---------|
| `src/lib/db.ts` | Types | Add `CredentialSource`, update `CredentialRequirement`, update `FetchConfig` |
| `src/lib/widget-package.ts` | Types | Update validation |
| `src/app/api/widgets/import/route.ts` | API | Handle agent credentials differently |
| `src/app/api/widgets/route.ts` | API | Accept and default `source` field |
| `src/app/api/widgets/[slug]/route.ts` | API | Same as above |
| `src/components/dashboard/WidgetInfoModal.tsx` | UI | Display both credential types |
| `src/components/dashboard/CredentialSetupWizard.tsx` | UI | Filter agent credentials |
| `src/components/dashboard/WidgetImportModal.tsx` | UI | Show both types in preview |
| `src/components/dashboard/CredentialsModal.tsx` | UI | Add informational note |
| `docs/widget-sdk.md` | Docs | New "Credential Types" section |

**Total estimated effort:** 4-6 hours for a focused implementation
