import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Database path - defaults to project root/data/glance.db
const DB_PATH =
  process.env.DATABASE_PATH || path.join(process.cwd(), "data", "glance.db");

// Lazy-initialized database instance
let _db: Database.Database | null = null;

// Get database instance (lazy initialization)
function getDb(): Database.Database {
  if (_db) return _db;

  // Skip database initialization during build time on Vercel
  if (process.env.NEXT_PHASE === "phase-production-build") {
    throw new Error("Database cannot be accessed during build time");
  }

  // Ensure data directory exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize database
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");

  // Initialize base schema (without new columns that need migration)
  _db.exec(`
    -- Widgets (base table without custom_widget_id for migration compatibility)
    CREATE TABLE IF NOT EXISTS widgets (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      position TEXT NOT NULL DEFAULT '{}',
      data_source TEXT,
      data_cache TEXT,
      data_updated_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Dashboard settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Notes content (for notes widget)
    CREATE TABLE IF NOT EXISTS notes (
      widget_id TEXT PRIMARY KEY,
      content TEXT DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Bookmarks (for bookmarks widget)
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      widget_id TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Event log (for debugging/replay)
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      payload TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Base indexes
    CREATE INDEX IF NOT EXISTS idx_bookmarks_widget_id ON bookmarks(widget_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
  `);

  // Migration: Add custom_widget_id column if it doesn't exist (for existing databases)
  {
    const tableInfo = _db.prepare("PRAGMA table_info(widgets)").all() as Array<{
      name: string;
    }>;
    const hasCustomWidgetId = tableInfo.some(
      (col) => col.name === "custom_widget_id",
    );
    if (!hasCustomWidgetId) {
      _db.exec(`ALTER TABLE widgets ADD COLUMN custom_widget_id TEXT`);
    }
  }

  // Migration: Add mobile_position column for responsive layouts
  {
    const tableInfo = _db.prepare("PRAGMA table_info(widgets)").all() as Array<{
      name: string;
    }>;
    const hasMobilePosition = tableInfo.some(
      (col) => col.name === "mobile_position",
    );
    if (!hasMobilePosition) {
      _db.exec(`ALTER TABLE widgets ADD COLUMN mobile_position TEXT`);
    }
  }

  // Create custom_widgets table FIRST (before migrations)
  _db.exec(`
    -- Custom widget definitions (JSX code stored here)
    CREATE TABLE IF NOT EXISTS custom_widgets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      source_code TEXT NOT NULL,
      compiled_code TEXT,
      default_size TEXT DEFAULT '{"w":4,"h":3}',
      min_size TEXT DEFAULT '{"w":2,"h":2}',
      data_providers TEXT DEFAULT '[]',
      refresh_interval INTEGER DEFAULT 300,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      enabled INTEGER DEFAULT 1,
      server_code TEXT,
      server_code_enabled INTEGER DEFAULT 0,
      -- Widget package fields
      credentials TEXT DEFAULT '[]',
      setup TEXT,
      fetch TEXT DEFAULT '{"type":"agent_refresh"}',
      cache TEXT,
      author TEXT
    );

    -- Data providers for widget data fetching
    CREATE TABLE IF NOT EXISTS data_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      base_url TEXT NOT NULL,
      auth_type TEXT DEFAULT 'bearer',
      credential_id TEXT,
      default_headers TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Widget setup tracking
    CREATE TABLE IF NOT EXISTS widget_setups (
      id TEXT PRIMARY KEY,
      widget_slug TEXT NOT NULL,
      status TEXT DEFAULT 'not_configured',
      verified_at TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Widget data cache (for agent_refresh widgets)
    CREATE TABLE IF NOT EXISTS widget_data_cache (
      widget_instance_id TEXT NOT NULL,
      custom_widget_id TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      params_hash TEXT,
      PRIMARY KEY (widget_instance_id)
    );

    -- Create indexes for custom widgets (column now exists)
    CREATE INDEX IF NOT EXISTS idx_custom_widgets_slug ON custom_widgets(slug);
    CREATE INDEX IF NOT EXISTS idx_widgets_custom_widget_id ON widgets(custom_widget_id);
    CREATE INDEX IF NOT EXISTS idx_data_providers_slug ON data_providers(slug);
    CREATE INDEX IF NOT EXISTS idx_widget_setups_slug ON widget_setups(widget_slug);
    CREATE INDEX IF NOT EXISTS idx_widget_data_cache_expires ON widget_data_cache(expires_at);
  `);

  // Migration: Add data_schema column to custom_widgets for JSON Schema validation
  {
    const tableInfo = _db.prepare("PRAGMA table_info(custom_widgets)").all() as Array<{
      name: string;
    }>;
    const hasDataSchema = tableInfo.some(
      (col) => col.name === "data_schema",
    );
    if (!hasDataSchema) {
      _db.exec(`ALTER TABLE custom_widgets ADD COLUMN data_schema TEXT`);
    }
  }

  return _db;
}

// Type definitions
export interface WidgetRow {
  id: string;
  type: string;
  title: string;
  config: string;
  position: string;
  mobile_position: string | null;
  data_source: string | null;
  data_cache: string | null;
  data_updated_at: string | null;
  custom_widget_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  widget_id: string;
  content: string;
  updated_at: string;
}

export interface BookmarkRow {
  id: string;
  widget_id: string;
  title: string;
  url: string;
  icon: string | null;
  position: number;
  created_at: string;
}

export interface EventRow {
  id: number;
  type: string;
  payload: string | null;
  created_at: string;
}

export interface CustomWidgetRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_code: string;
  compiled_code: string | null;
  default_size: string;
  min_size: string;
  data_providers: string;
  refresh_interval: number;
  created_at: string;
  updated_at: string;
  enabled: number;
  server_code: string | null;
  server_code_enabled: number;
  // Widget package fields
  credentials: string;
  setup: string | null;
  fetch: string;
  cache: string | null;
  author: string | null;
  data_schema: string | null;
}

export interface WidgetSetupRow {
  id: string;
  widget_slug: string;
  status: string;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataProviderRow {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  auth_type: string;
  credential_id: string | null;
  default_headers: string;
  created_at: string;
}

// Lazy-initialized prepared statements
let _stmts: ReturnType<typeof createStatements> | null = null;

function createStatements(db: Database.Database) {
  return {
    // Widgets
    getAllWidgets: db.prepare("SELECT * FROM widgets ORDER BY created_at"),
    getWidget: db.prepare("SELECT * FROM widgets WHERE id = ?"),
    insertWidget: db.prepare(`
      INSERT INTO widgets (id, type, title, config, position, data_source, custom_widget_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    updateWidget: db.prepare(`
      UPDATE widgets 
      SET title = ?, config = ?, position = ?, data_source = ?, updated_at = datetime('now')
      WHERE id = ?
    `),
    updateWidgetData: db.prepare(`
      UPDATE widgets 
      SET data_cache = ?, data_updated_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `),
    deleteWidget: db.prepare("DELETE FROM widgets WHERE id = ?"),

    // Notes
    getNote: db.prepare("SELECT * FROM notes WHERE widget_id = ?"),
    upsertNote: db.prepare(`
      INSERT INTO notes (widget_id, content, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(widget_id) DO UPDATE SET content = ?, updated_at = datetime('now')
    `),
    deleteNote: db.prepare("DELETE FROM notes WHERE widget_id = ?"),

    // Bookmarks
    getBookmarks: db.prepare(
      "SELECT * FROM bookmarks WHERE widget_id = ? ORDER BY position",
    ),
    insertBookmark: db.prepare(`
      INSERT INTO bookmarks (id, widget_id, title, url, icon, position)
      VALUES (?, ?, ?, ?, ?, ?)
    `),
    updateBookmark: db.prepare(`
      UPDATE bookmarks SET title = ?, url = ?, icon = ?, position = ? WHERE id = ?
    `),
    deleteBookmark: db.prepare("DELETE FROM bookmarks WHERE id = ?"),
    deleteBookmarksByWidget: db.prepare(
      "DELETE FROM bookmarks WHERE widget_id = ?",
    ),

    // Settings
    getSetting: db.prepare("SELECT value FROM settings WHERE key = ?"),
    upsertSetting: db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = ?
    `),

    // Events
    insertEvent: db.prepare("INSERT INTO events (type, payload) VALUES (?, ?)"),
    getRecentEvents: db.prepare(
      "SELECT * FROM events ORDER BY id DESC LIMIT ?",
    ),

    // Custom Widgets
    getAllCustomWidgets: db.prepare(
      "SELECT * FROM custom_widgets WHERE enabled = 1 ORDER BY name",
    ),
    getAllCustomWidgetsIncludingDisabled: db.prepare(
      "SELECT * FROM custom_widgets ORDER BY name",
    ),
    getCustomWidget: db.prepare("SELECT * FROM custom_widgets WHERE id = ?"),
    getCustomWidgetBySlug: db.prepare(
      "SELECT * FROM custom_widgets WHERE slug = ?",
    ),
    insertCustomWidget: db.prepare(`
      INSERT INTO custom_widgets (id, name, slug, description, source_code, compiled_code, default_size, min_size, data_providers, refresh_interval, enabled, server_code, server_code_enabled, credentials, setup, fetch, cache, author, data_schema)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    updateCustomWidget: db.prepare(`
      UPDATE custom_widgets
      SET name = ?, description = ?, source_code = ?, compiled_code = ?, default_size = ?, min_size = ?, data_providers = ?, refresh_interval = ?, enabled = ?, server_code = ?, server_code_enabled = ?, credentials = ?, setup = ?, fetch = ?, cache = ?, author = ?, data_schema = ?, updated_at = datetime('now')
      WHERE id = ?
    `),
    deleteCustomWidget: db.prepare("DELETE FROM custom_widgets WHERE id = ?"),

    // Widget Setups
    getWidgetSetup: db.prepare("SELECT * FROM widget_setups WHERE widget_slug = ?"),
    getAllWidgetSetups: db.prepare("SELECT * FROM widget_setups ORDER BY updated_at DESC"),
    upsertWidgetSetup: db.prepare(`
      INSERT INTO widget_setups (id, widget_slug, status, verified_at, notes, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET status = ?, verified_at = ?, notes = ?, updated_at = datetime('now')
    `),
    deleteWidgetSetup: db.prepare("DELETE FROM widget_setups WHERE id = ?"),

    // Data Providers
    getAllDataProviders: db.prepare(
      "SELECT * FROM data_providers ORDER BY name",
    ),
    getDataProvider: db.prepare("SELECT * FROM data_providers WHERE id = ?"),
    getDataProviderBySlug: db.prepare(
      "SELECT * FROM data_providers WHERE slug = ?",
    ),
    insertDataProvider: db.prepare(`
      INSERT INTO data_providers (id, name, slug, base_url, auth_type, credential_id, default_headers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    updateDataProvider: db.prepare(`
      UPDATE data_providers 
      SET name = ?, base_url = ?, auth_type = ?, credential_id = ?, default_headers = ?
      WHERE id = ?
    `),
    deleteDataProvider: db.prepare("DELETE FROM data_providers WHERE id = ?"),
  };
}

function getStmts() {
  if (_stmts) return _stmts;
  _stmts = createStatements(getDb());
  return _stmts;
}

// Widget functions
export function getAllWidgets(): WidgetRow[] {
  return getStmts().getAllWidgets.all() as WidgetRow[];
}

export function getWidget(id: string): WidgetRow | undefined {
  return getStmts().getWidget.get(id) as WidgetRow | undefined;
}

export function createWidget(
  id: string,
  type: string,
  title: string,
  config: object,
  position: object,
  dataSource?: object,
  customWidgetId?: string,
): void {
  getStmts().insertWidget.run(
    id,
    type,
    title,
    JSON.stringify(config),
    JSON.stringify(position),
    dataSource ? JSON.stringify(dataSource) : null,
    customWidgetId || null,
  );
  logEvent("widget_created", { id, type, title, customWidgetId });
}

export function updateWidget(
  id: string,
  title: string,
  config: object,
  position: object,
  dataSource?: object,
): void {
  getStmts().updateWidget.run(
    title,
    JSON.stringify(config),
    JSON.stringify(position),
    dataSource ? JSON.stringify(dataSource) : null,
    id,
  );
  logEvent("widget_updated", { id });
}

export function updateWidgetData(id: string, data: object): void {
  getStmts().updateWidgetData.run(JSON.stringify(data), id);
  logEvent("data_refreshed", { id });
}

export function deleteWidget(id: string): void {
  const stmts = getStmts();
  stmts.deleteWidget.run(id);
  stmts.deleteNote.run(id);
  stmts.deleteBookmarksByWidget.run(id);
  logEvent("widget_deleted", { id });
}

// Notes functions
export function getNote(widgetId: string): NoteRow | undefined {
  return getStmts().getNote.get(widgetId) as NoteRow | undefined;
}

export function upsertNote(widgetId: string, content: string): void {
  getStmts().upsertNote.run(widgetId, content, content);
}

// Bookmarks functions
export function getBookmarks(widgetId: string): BookmarkRow[] {
  return getStmts().getBookmarks.all(widgetId) as BookmarkRow[];
}

export function createBookmark(
  id: string,
  widgetId: string,
  title: string,
  url: string,
  icon?: string,
  position?: number,
): void {
  getStmts().insertBookmark.run(
    id,
    widgetId,
    title,
    url,
    icon || null,
    position || 0,
  );
}

export function updateBookmark(
  id: string,
  title: string,
  url: string,
  icon?: string,
  position?: number,
): void {
  getStmts().updateBookmark.run(title, url, icon || null, position || 0, id);
}

export function deleteBookmark(id: string): void {
  getStmts().deleteBookmark.run(id);
}

// Settings functions
export function getSetting(key: string): string | undefined {
  const row = getStmts().getSetting.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  getStmts().upsertSetting.run(key, value, value);
}

// Events functions
export function logEvent(type: string, payload?: object): void {
  getStmts().insertEvent.run(type, payload ? JSON.stringify(payload) : null);
}

export function getRecentEvents(limit: number = 100): EventRow[] {
  return getStmts().getRecentEvents.all(limit) as EventRow[];
}

// Layout helpers
export function getLayout(): object[] {
  const widgets = getAllWidgets();
  return widgets.map((w) => ({
    i: w.id,
    ...JSON.parse(w.position),
  }));
}

export function updateLayout(
  layout: Array<{ i: string; x: number; y: number; w: number; h: number }>,
): void {
  const db = getDb();
  const updatePos = db.prepare(
    "UPDATE widgets SET position = ?, updated_at = datetime('now') WHERE id = ?",
  );
  const transaction = db.transaction((items: typeof layout) => {
    for (const item of items) {
      updatePos.run(
        JSON.stringify({ x: item.x, y: item.y, w: item.w, h: item.h }),
        item.i,
      );
    }
  });
  transaction(layout);
}

// Widget Package Types
export interface CacheConfig {
  ttl_seconds: number;              // How long data is "fresh"
  max_staleness_seconds?: number;   // How long data is "usable but stale"
  storage?: "memory" | "sqlite";    // Default: sqlite
  on_error?: "use_stale" | "show_error";  // Behavior when fetch fails
  info?: string;                    // AI agent context
}

export interface CredentialRequirement {
  id: string;
  type: "api_key" | "local_software" | "oauth" | "agent";
  name: string;
  description: string;
  info?: string;                    // AI agent context for this credential
  // For api_key
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
  // For agent (tools/auth that exist on the OpenClaw agent's machine)
  agent_tool?: string;              // e.g., "gh", "gcloud", "aws"
  agent_auth_check?: string;        // Command to verify auth: "gh auth status"
  agent_auth_instructions?: string; // How to authenticate the tool
}

export interface SetupConfig {
  description: string;
  agent_skill: string;
  verification: {
    type: "command_succeeds" | "endpoint_responds" | "cache_populated";
    target: string;  // Command, URL, or widget slug (for cache_populated)
  };
  idempotent: boolean;
  estimated_time?: string;
  info?: string;                    // AI agent context for setup
}

export interface FetchConfig {
  type: "server_code" | "webhook" | "agent_refresh";
  info?: string;                       // AI agent context for data fetching
  // For webhook
  webhook_path?: string;
  webhook_setup_instructions?: string;
  refresh_endpoint?: string;           // External endpoint to trigger refresh
  // For agent_refresh
  instructions?: string;              // Markdown instructions for the agent
  expected_freshness_seconds?: number; // Agent SHOULD refresh within this window
  max_staleness_seconds?: number;      // Widget SHOULD show warning after this
  schedule?: string;                   // Cron expression (e.g., "*/5 * * * *" for every 5 min)
}

export interface ErrorConfig {
  retry?: { max_attempts: number; backoff_ms: number };
  fallback?: "use_stale" | "show_error" | "show_placeholder";
  placeholder_data?: unknown;
  timeout_ms?: number;
}

// Custom Widget functions
// JSON Schema type for data validation
export interface DataSchema {
  type: string;
  properties?: Record<string, DataSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface DataSchemaProperty {
  type: string;
  description?: string;
  format?: string;
  items?: DataSchemaProperty;
  properties?: Record<string, DataSchemaProperty>;
  required?: string[];
}

export interface CustomWidget {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  source_code: string;
  compiled_code: string | null;
  default_size: { w: number; h: number };
  min_size: { w: number; h: number };
  data_providers: string[];
  refresh_interval: number;
  created_at: string;
  updated_at: string;
  enabled: boolean;
  server_code: string | null;
  server_code_enabled: boolean;
  // Widget package fields
  credentials: CredentialRequirement[];
  setup: SetupConfig | null;
  fetch: FetchConfig;
  cache: CacheConfig | null;
  author: string | null;
  error?: ErrorConfig;
  // Data validation schema (JSON Schema format)
  data_schema: DataSchema | null;
}

export interface WidgetSetup {
  id: string;
  widget_slug: string;
  status: "not_configured" | "configured" | "failed";
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCustomWidget(row: CustomWidgetRow): CustomWidget {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    source_code: row.source_code,
    compiled_code: row.compiled_code,
    default_size: JSON.parse(row.default_size),
    min_size: JSON.parse(row.min_size),
    data_providers: JSON.parse(row.data_providers),
    refresh_interval: row.refresh_interval,
    created_at: row.created_at,
    updated_at: row.updated_at,
    enabled: row.enabled === 1,
    server_code: row.server_code,
    server_code_enabled: row.server_code_enabled === 1,
    // Widget package fields
    credentials: row.credentials ? JSON.parse(row.credentials) : [],
    setup: row.setup ? JSON.parse(row.setup) : null,
    fetch: row.fetch ? JSON.parse(row.fetch) : { type: "server_code" },
    cache: row.cache ? JSON.parse(row.cache) : null,
    author: row.author,
    data_schema: row.data_schema ? JSON.parse(row.data_schema) : null,
  };
}

function rowToWidgetSetup(row: WidgetSetupRow): WidgetSetup {
  return {
    id: row.id,
    widget_slug: row.widget_slug,
    status: row.status as WidgetSetup["status"],
    verified_at: row.verified_at,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function getAllCustomWidgets(includeDisabled = false): CustomWidget[] {
  const stmts = getStmts();
  const rows = (
    includeDisabled
      ? stmts.getAllCustomWidgetsIncludingDisabled.all()
      : stmts.getAllCustomWidgets.all()
  ) as CustomWidgetRow[];
  return rows.map(rowToCustomWidget);
}

export function getCustomWidget(id: string): CustomWidget | undefined {
  const row = getStmts().getCustomWidget.get(id) as CustomWidgetRow | undefined;
  return row ? rowToCustomWidget(row) : undefined;
}

export function getCustomWidgetBySlug(slug: string): CustomWidget | undefined {
  const row = getStmts().getCustomWidgetBySlug.get(slug) as
    | CustomWidgetRow
    | undefined;
  return row ? rowToCustomWidget(row) : undefined;
}

export function createCustomWidget(
  id: string,
  name: string,
  slug: string,
  description: string | null,
  sourceCode: string,
  compiledCode: string | null,
  defaultSize: { w: number; h: number },
  minSize: { w: number; h: number },
  dataProviders: string[],
  refreshInterval: number,
  enabled: boolean = true,
  serverCode: string | null = null,
  serverCodeEnabled: boolean = false,
  credentials: CredentialRequirement[] = [],
  setup: SetupConfig | null = null,
  fetch: FetchConfig = { type: "server_code" },
  cache: CacheConfig | null = null,
  author: string | null = null,
  data_schema: DataSchema | null = null,
): void {
  getStmts().insertCustomWidget.run(
    id,
    name,
    slug,
    description,
    sourceCode,
    compiledCode,
    JSON.stringify(defaultSize),
    JSON.stringify(minSize),
    JSON.stringify(dataProviders),
    refreshInterval,
    enabled ? 1 : 0,
    serverCode,
    serverCodeEnabled ? 1 : 0,
    JSON.stringify(credentials),
    setup ? JSON.stringify(setup) : null,
    JSON.stringify(fetch),
    cache ? JSON.stringify(cache) : null,
    author,
    data_schema ? JSON.stringify(data_schema) : null,
  );
  logEvent("custom_widget_created", { id, name, slug });
}

export function updateCustomWidget(
  id: string,
  name: string,
  description: string | null,
  sourceCode: string,
  compiledCode: string | null,
  defaultSize: { w: number; h: number },
  minSize: { w: number; h: number },
  dataProviders: string[],
  refreshInterval: number,
  enabled: boolean,
  serverCode: string | null = null,
  serverCodeEnabled: boolean = false,
  credentials: CredentialRequirement[] = [],
  setup: SetupConfig | null = null,
  fetch: FetchConfig = { type: "server_code" },
  cache: CacheConfig | null = null,
  author: string | null = null,
  data_schema: DataSchema | null = null,
): void {
  getStmts().updateCustomWidget.run(
    name,
    description,
    sourceCode,
    compiledCode,
    JSON.stringify(defaultSize),
    JSON.stringify(minSize),
    JSON.stringify(dataProviders),
    refreshInterval,
    enabled ? 1 : 0,
    serverCode,
    serverCodeEnabled ? 1 : 0,
    JSON.stringify(credentials),
    setup ? JSON.stringify(setup) : null,
    JSON.stringify(fetch),
    cache ? JSON.stringify(cache) : null,
    author,
    data_schema ? JSON.stringify(data_schema) : null,
    id,
  );
  logEvent("custom_widget_updated", { id, name });
}

export function deleteCustomWidget(id: string): void {
  const db = getDb();
  // First, delete any widget instances that use this custom widget
  const deleteInstances = db.prepare(
    "DELETE FROM widgets WHERE custom_widget_id = ?",
  );
  deleteInstances.run(id);

  getStmts().deleteCustomWidget.run(id);
  logEvent("custom_widget_deleted", { id });
}

// Data Provider functions
export interface DataProvider {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  auth_type: "bearer" | "basic" | "header" | "none";
  credential_id: string | null;
  default_headers: Record<string, string>;
  created_at: string;
}

function rowToDataProvider(row: DataProviderRow): DataProvider {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    base_url: row.base_url,
    auth_type: row.auth_type as DataProvider["auth_type"],
    credential_id: row.credential_id,
    default_headers: JSON.parse(row.default_headers),
    created_at: row.created_at,
  };
}

export function getAllDataProviders(): DataProvider[] {
  const rows = getStmts().getAllDataProviders.all() as DataProviderRow[];
  return rows.map(rowToDataProvider);
}

export function getDataProvider(id: string): DataProvider | undefined {
  const row = getStmts().getDataProvider.get(id) as DataProviderRow | undefined;
  return row ? rowToDataProvider(row) : undefined;
}

export function getDataProviderBySlug(slug: string): DataProvider | undefined {
  const row = getStmts().getDataProviderBySlug.get(slug) as
    | DataProviderRow
    | undefined;
  return row ? rowToDataProvider(row) : undefined;
}

export function createDataProvider(
  id: string,
  name: string,
  slug: string,
  baseUrl: string,
  authType: DataProvider["auth_type"],
  credentialId: string | null,
  defaultHeaders: Record<string, string>,
): void {
  getStmts().insertDataProvider.run(
    id,
    name,
    slug,
    baseUrl,
    authType,
    credentialId,
    JSON.stringify(defaultHeaders),
  );
  logEvent("data_provider_created", { id, name, slug });
}

export function updateDataProvider(
  id: string,
  name: string,
  baseUrl: string,
  authType: DataProvider["auth_type"],
  credentialId: string | null,
  defaultHeaders: Record<string, string>,
): void {
  getStmts().updateDataProvider.run(
    name,
    baseUrl,
    authType,
    credentialId,
    JSON.stringify(defaultHeaders),
    id,
  );
  logEvent("data_provider_updated", { id, name });
}

export function deleteDataProvider(id: string): void {
  getStmts().deleteDataProvider.run(id);
  logEvent("data_provider_deleted", { id });
}

// Widget Setup functions
export function getWidgetSetup(widgetSlug: string): WidgetSetup | undefined {
  const row = getStmts().getWidgetSetup.get(widgetSlug) as WidgetSetupRow | undefined;
  return row ? rowToWidgetSetup(row) : undefined;
}

export function getAllWidgetSetups(): WidgetSetup[] {
  const rows = getStmts().getAllWidgetSetups.all() as WidgetSetupRow[];
  return rows.map(rowToWidgetSetup);
}

export function upsertWidgetSetup(
  id: string,
  widgetSlug: string,
  status: WidgetSetup["status"],
  verifiedAt: string | null = null,
  notes: string | null = null,
): void {
  getStmts().upsertWidgetSetup.run(
    id,
    widgetSlug,
    status,
    verifiedAt,
    notes,
    status,
    verifiedAt,
    notes,
  );
  logEvent("widget_setup_updated", { id, widgetSlug, status });
}

export function deleteWidgetSetup(id: string): void {
  getStmts().deleteWidgetSetup.run(id);
  logEvent("widget_setup_deleted", { id });
}

// Get widgets by custom widget ID
export function getWidgetsByCustomWidgetId(customWidgetId: string): WidgetRow[] {
  const db = getDb();
  const stmt = db.prepare("SELECT * FROM widgets WHERE custom_widget_id = ?");
  return stmt.all(customWidgetId) as WidgetRow[];
}

// Widget Data Cache Types and Functions
export interface WidgetDataCache {
  widget_instance_id: string;
  custom_widget_id: string;
  data: unknown;
  fetched_at: string;
  expires_at: string;
  params_hash: string | null;
}

interface WidgetDataCacheRow {
  widget_instance_id: string;
  custom_widget_id: string;
  data: string;
  fetched_at: string;
  expires_at: string;
  params_hash: string | null;
}

// Lazy-initialized cache statements
let _cacheStmts: {
  getCachedWidgetData: Database.Statement;
  setCachedWidgetData: Database.Statement;
  deleteCachedWidgetData: Database.Statement;
  deleteExpiredCache: Database.Statement;
} | null = null;

function getCacheStmts() {
  if (_cacheStmts) return _cacheStmts;
  
  const db = getDb();
  
  // Create cache table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_data_cache (
      widget_instance_id TEXT PRIMARY KEY,
      custom_widget_id TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      params_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_widget_data_cache_expires ON widget_data_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_widget_data_cache_custom_widget ON widget_data_cache(custom_widget_id);
  `);
  
  _cacheStmts = {
    getCachedWidgetData: db.prepare(
      "SELECT * FROM widget_data_cache WHERE widget_instance_id = ?"
    ),
    setCachedWidgetData: db.prepare(`
      INSERT INTO widget_data_cache (widget_instance_id, custom_widget_id, data, fetched_at, expires_at, params_hash)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(widget_instance_id) DO UPDATE SET
        custom_widget_id = excluded.custom_widget_id,
        data = excluded.data,
        fetched_at = excluded.fetched_at,
        expires_at = excluded.expires_at,
        params_hash = excluded.params_hash
    `),
    deleteCachedWidgetData: db.prepare(
      "DELETE FROM widget_data_cache WHERE widget_instance_id = ?"
    ),
    deleteExpiredCache: db.prepare(
      "DELETE FROM widget_data_cache WHERE expires_at < datetime('now')"
    ),
  };
  
  return _cacheStmts;
}

export function getCachedWidgetData(instanceId: string): WidgetDataCache | undefined {
  const row = getCacheStmts().getCachedWidgetData.get(instanceId) as WidgetDataCacheRow | undefined;
  if (!row) return undefined;
  
  return {
    widget_instance_id: row.widget_instance_id,
    custom_widget_id: row.custom_widget_id,
    data: JSON.parse(row.data),
    fetched_at: row.fetched_at,
    expires_at: row.expires_at,
    params_hash: row.params_hash,
  };
}

export function setCachedWidgetData(
  instanceId: string,
  customWidgetId: string,
  data: unknown,
  ttlSeconds: number,
  paramsHash?: string
): void {
  const now = new Date();
  const fetchedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
  
  getCacheStmts().setCachedWidgetData.run(
    instanceId,
    customWidgetId,
    JSON.stringify(data),
    fetchedAt,
    expiresAt,
    paramsHash || null
  );
  
  logEvent("widget_cache_set", { instanceId, customWidgetId, ttlSeconds });
}

export function invalidateWidgetCache(instanceId: string): void {
  getCacheStmts().deleteCachedWidgetData.run(instanceId);
  logEvent("widget_cache_invalidated", { instanceId });
}

export function deleteExpiredCache(): number {
  const result = getCacheStmts().deleteExpiredCache.run();
  const deleted = result.changes;
  if (deleted > 0) {
    logEvent("widget_cache_cleanup", { deleted });
  }
  return deleted;
}

// Export getter for direct db access (use sparingly)
export function getDatabase(): Database.Database {
  return getDb();
}

// Get pending refresh request for a widget (for agent_refresh widgets)
export function getPendingRefreshRequest(widgetSlug: string): { requested_at: string } | null {
  const db = getDb();

  // Check if table exists first
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='widget_refresh_requests'
  `).get();

  if (!tableExists) {
    return null;
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const result = db.prepare(`
    SELECT requested_at FROM widget_refresh_requests
    WHERE widget_slug = ?
      AND processed_at IS NULL
      AND requested_at > ?
    ORDER BY requested_at DESC
    LIMIT 1
  `).get(widgetSlug, fiveMinutesAgo) as { requested_at: string } | undefined;

  return result || null;
}

export default { getDatabase };
