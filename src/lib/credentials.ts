import crypto from "crypto";
import fs from "fs";
import path from "path";
import db from "./db";

// Credential types
export interface Credential {
  id: string;
  provider: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CredentialRow {
  id: string;
  provider: string;
  name: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  metadata: string;
  created_at: string;
  updated_at: string;
}

// Provider definitions for validation
export const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    description: "Claude API (Admin key for usage widgets)",
    validateUrl: "https://api.anthropic.com/v1/organizations/cost_report",
    envFallback: "ANTHROPIC_ADMIN_KEY",
  },
  openai: {
    name: "OpenAI",
    description: "GPT API (Admin key for usage widgets)",
    validateUrl: "https://api.openai.com/v1/organization/costs",
    envFallback: "OPENAI_ADMIN_KEY",
  },
  vercel: {
    name: "Vercel",
    description: "Vercel API for deployment widgets",
    validateUrl: "https://api.vercel.com/v2/user",
    envFallback: "VERCEL_TOKEN",
  },
  github: {
    name: "GitHub",
    description: "GitHub API for PR widgets",
    validateUrl: "https://api.github.com/user",
    envFallback: "GITHUB_TOKEN",
  },
  openweather: {
    name: "OpenWeather",
    description: "Weather data API",
    validateUrl: null, // Needs location param
    envFallback: "OPENWEATHER_API_KEY",
  },
} as const;

export type Provider = keyof typeof PROVIDERS;

// Initialize credentials table
db.exec(`
  CREATE TABLE IF NOT EXISTS credentials (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    name TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_credentials_provider ON credentials(provider);
`);

// Encryption constants
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const SALT = "glance-credential-salt-v1"; // Static salt for key derivation
const ITERATIONS = 100000;

// Path to store auto-generated auth token
const DATA_DIR = process.env.DATABASE_PATH
  ? path.dirname(process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data");
const AUTH_TOKEN_FILE = path.join(DATA_DIR, ".auth_token");

/**
 * Get or generate AUTH_TOKEN
 * Priority: 1. Environment variable, 2. Persisted file, 3. Generate new
 */
function getAuthToken(): string {
  // 1. Check environment variable first
  if (process.env.AUTH_TOKEN) {
    return process.env.AUTH_TOKEN;
  }

  // 2. Check for persisted token file
  try {
    if (fs.existsSync(AUTH_TOKEN_FILE)) {
      const token = fs.readFileSync(AUTH_TOKEN_FILE, "utf8").trim();
      if (token) {
        return token;
      }
    }
  } catch {
    // Ignore read errors, will generate new token
  }

  // 3. Generate new token and persist it
  const newToken = crypto.randomBytes(32).toString("base64");

  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AUTH_TOKEN_FILE, newToken, { mode: 0o600 });
    console.log(
      "[glance] Generated new encryption key (stored in data/.auth_token)",
    );
  } catch (err) {
    console.warn("[glance] Could not persist auth token:", err);
  }

  return newToken;
}

// Cache the auth token for the lifetime of the process
let cachedAuthToken: string | null = null;

/**
 * Derive encryption key from AUTH_TOKEN using PBKDF2
 */
function deriveKey(): Buffer {
  if (!cachedAuthToken) {
    cachedAuthToken = getAuthToken();
  }

  return crypto.pbkdf2Sync(
    cachedAuthToken,
    SALT,
    ITERATIONS,
    KEY_LENGTH,
    "sha256",
  );
}

/**
 * Encrypt a credential value
 */
function encrypt(plaintext: string): {
  encrypted: string;
  iv: string;
  authTag: string;
} {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

/**
 * Decrypt a credential value
 */
function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = deriveKey();
  const ivBuffer = Buffer.from(iv, "base64");
  const authTagBuffer = Buffer.from(authTag, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
  decipher.setAuthTag(authTagBuffer);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Prepared statements
const stmts = {
  getAll: db.prepare(
    "SELECT id, provider, name, metadata, created_at, updated_at FROM credentials ORDER BY provider, name",
  ),
  getById: db.prepare("SELECT * FROM credentials WHERE id = ?"),
  getByProvider: db.prepare(
    "SELECT * FROM credentials WHERE provider = ? ORDER BY created_at DESC LIMIT 1",
  ),
  getAllByProvider: db.prepare("SELECT * FROM credentials WHERE provider = ?"),
  insert: db.prepare(`
    INSERT INTO credentials (id, provider, name, encrypted_value, iv, auth_tag, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  update: db.prepare(`
    UPDATE credentials 
    SET name = ?, encrypted_value = ?, iv = ?, auth_tag = ?, metadata = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  delete: db.prepare("DELETE FROM credentials WHERE id = ?"),
};

/**
 * Generate a unique credential ID
 */
function generateId(): string {
  return `cred_${crypto.randomBytes(12).toString("hex")}`;
}

/**
 * List all credentials (without decrypted values)
 */
export function listCredentials(): Credential[] {
  const rows = stmts.getAll.all() as Array<{
    id: string;
    provider: string;
    name: string;
    metadata: string;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Get a specific credential by ID (without decrypted value)
 */
export function getCredentialById(id: string): Credential | null {
  const row = stmts.getById.get(id) as CredentialRow | undefined;
  if (!row) return null;

  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Get decrypted credential value for a provider
 * Falls back to environment variable if no stored credential exists
 */
export function getCredential(provider: Provider): string | null {
  try {
    const row = stmts.getByProvider.get(provider) as CredentialRow | undefined;

    if (row) {
      return decrypt(row.encrypted_value, row.iv, row.auth_tag);
    }

    // Fallback to environment variable
    const providerConfig = PROVIDERS[provider];
    if (providerConfig?.envFallback) {
      return process.env[providerConfig.envFallback] || null;
    }

    return null;
  } catch (error) {
    console.error(`Failed to get credential for ${provider}:`, error);

    // Fallback to env on decryption error (e.g., AUTH_TOKEN changed)
    const providerConfig = PROVIDERS[provider];
    if (providerConfig?.envFallback) {
      return process.env[providerConfig.envFallback] || null;
    }

    return null;
  }
}

/**
 * Get decrypted credential value by ID
 */
export function getCredentialValue(id: string): string | null {
  const row = stmts.getById.get(id) as CredentialRow | undefined;
  if (!row) return null;

  return decrypt(row.encrypted_value, row.iv, row.auth_tag);
}

/**
 * Store a new credential
 */
export function createCredential(
  provider: Provider,
  name: string,
  value: string,
  metadata: Record<string, unknown> = {},
): Credential {
  const id = generateId();
  const { encrypted, iv, authTag } = encrypt(value);

  stmts.insert.run(
    id,
    provider,
    name,
    encrypted,
    iv,
    authTag,
    JSON.stringify(metadata),
  );

  return {
    id,
    provider,
    name,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Update an existing credential
 */
export function updateCredential(
  id: string,
  name: string,
  value: string,
  metadata: Record<string, unknown> = {},
): boolean {
  const existing = stmts.getById.get(id) as CredentialRow | undefined;
  if (!existing) return false;

  const { encrypted, iv, authTag } = encrypt(value);

  stmts.update.run(name, encrypted, iv, authTag, JSON.stringify(metadata), id);
  return true;
}

/**
 * Delete a credential
 */
export function deleteCredential(id: string): boolean {
  const result = stmts.delete.run(id);
  return result.changes > 0;
}

/**
 * Check if a provider has a configured credential
 */
export function hasCredential(provider: Provider): boolean {
  const row = stmts.getByProvider.get(provider) as CredentialRow | undefined;
  if (row) return true;

  // Check env fallback
  const providerConfig = PROVIDERS[provider];
  if (providerConfig?.envFallback && process.env[providerConfig.envFallback]) {
    return true;
  }

  return false;
}

/**
 * Validate a credential by making a test API call
 */
export async function validateCredential(
  provider: Provider,
  value: string,
): Promise<{ valid: boolean; error?: string }> {
  const providerConfig = PROVIDERS[provider];

  if (!providerConfig.validateUrl) {
    // Can't validate this provider
    return { valid: true };
  }

  try {
    let response: Response;

    switch (provider) {
      case "anthropic": {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const url = new URL(providerConfig.validateUrl);
        url.searchParams.set(
          "starting_at",
          startOfMonth.toISOString().split("T")[0] + "T00:00:00Z",
        );
        url.searchParams.set("ending_at", now.toISOString());

        response = await fetch(url.toString(), {
          headers: {
            "anthropic-version": "2023-06-01",
            "x-api-key": value,
            "content-type": "application/json",
          },
        });
        break;
      }

      case "openai": {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const url = new URL(providerConfig.validateUrl);
        url.searchParams.set(
          "start_time",
          Math.floor(startOfMonth.getTime() / 1000).toString(),
        );
        url.searchParams.set(
          "end_time",
          Math.floor(now.getTime() / 1000).toString(),
        );

        response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${value}`,
            "Content-Type": "application/json",
          },
        });
        break;
      }

      case "vercel":
        response = await fetch(providerConfig.validateUrl, {
          headers: {
            Authorization: `Bearer ${value}`,
          },
        });
        break;

      case "github":
        response = await fetch(providerConfig.validateUrl, {
          headers: {
            Authorization: `Bearer ${value}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        break;

      default:
        return { valid: true };
    }

    if (response.ok) {
      return { valid: true };
    }

    if (response.status === 401 || response.status === 403) {
      return { valid: false, error: "Invalid or expired API key" };
    }

    // Other errors might be permission-related but key is valid
    if (response.status >= 400 && response.status < 500) {
      return { valid: true }; // Assume key is valid but might lack permissions
    }

    return { valid: false, error: `API returned status ${response.status}` };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Validation failed",
    };
  }
}

/**
 * Get credential status for all providers
 */
export function getCredentialStatus(): Record<
  Provider,
  { configured: boolean; source: "database" | "env" | null }
> {
  const status: Record<
    string,
    { configured: boolean; source: "database" | "env" | null }
  > = {};

  for (const provider of Object.keys(PROVIDERS) as Provider[]) {
    const row = stmts.getByProvider.get(provider) as CredentialRow | undefined;

    if (row) {
      status[provider] = { configured: true, source: "database" };
    } else {
      const providerConfig = PROVIDERS[provider];
      if (
        providerConfig?.envFallback &&
        process.env[providerConfig.envFallback]
      ) {
        status[provider] = { configured: true, source: "env" };
      } else {
        status[provider] = { configured: false, source: null };
      }
    }
  }

  return status as Record<
    Provider,
    { configured: boolean; source: "database" | "env" | null }
  >;
}
