import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database path - defaults to project root/data/glance.db
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'glance.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize base schema (without new columns that need migration)
db.exec(`
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
  const tableInfo = db.prepare('PRAGMA table_info(widgets)').all() as Array<{ name: string }>;
  const hasCustomWidgetId = tableInfo.some(col => col.name === 'custom_widget_id');
  if (!hasCustomWidgetId) {
    db.exec(`ALTER TABLE widgets ADD COLUMN custom_widget_id TEXT`);
  }
}

// Create custom_widgets table and related indexes
db.exec(`
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
    server_code_enabled INTEGER DEFAULT 0
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

  -- Create indexes for custom widgets (column now exists)
  CREATE INDEX IF NOT EXISTS idx_custom_widgets_slug ON custom_widgets(slug);
  CREATE INDEX IF NOT EXISTS idx_widgets_custom_widget_id ON widgets(custom_widget_id);
  CREATE INDEX IF NOT EXISTS idx_data_providers_slug ON data_providers(slug);
`);

// Type definitions
export interface WidgetRow {
  id: string;
  type: string;
  title: string;
  config: string;
  position: string;
  data_source: string | null;
  data_cache: string | null;
  data_updated_at: string | null;
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

// Prepared statements for widgets
const stmts = {
  // Widgets
  getAllWidgets: db.prepare('SELECT * FROM widgets ORDER BY created_at'),
  getWidget: db.prepare('SELECT * FROM widgets WHERE id = ?'),
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
  deleteWidget: db.prepare('DELETE FROM widgets WHERE id = ?'),

  // Notes
  getNote: db.prepare('SELECT * FROM notes WHERE widget_id = ?'),
  upsertNote: db.prepare(`
    INSERT INTO notes (widget_id, content, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(widget_id) DO UPDATE SET content = ?, updated_at = datetime('now')
  `),
  deleteNote: db.prepare('DELETE FROM notes WHERE widget_id = ?'),

  // Bookmarks
  getBookmarks: db.prepare('SELECT * FROM bookmarks WHERE widget_id = ? ORDER BY position'),
  insertBookmark: db.prepare(`
    INSERT INTO bookmarks (id, widget_id, title, url, icon, position)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updateBookmark: db.prepare(`
    UPDATE bookmarks SET title = ?, url = ?, icon = ?, position = ? WHERE id = ?
  `),
  deleteBookmark: db.prepare('DELETE FROM bookmarks WHERE id = ?'),
  deleteBookmarksByWidget: db.prepare('DELETE FROM bookmarks WHERE widget_id = ?'),

  // Settings
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  upsertSetting: db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `),

  // Events
  insertEvent: db.prepare('INSERT INTO events (type, payload) VALUES (?, ?)'),
  getRecentEvents: db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?'),

  // Custom Widgets
  getAllCustomWidgets: db.prepare('SELECT * FROM custom_widgets WHERE enabled = 1 ORDER BY name'),
  getAllCustomWidgetsIncludingDisabled: db.prepare('SELECT * FROM custom_widgets ORDER BY name'),
  getCustomWidget: db.prepare('SELECT * FROM custom_widgets WHERE id = ?'),
  getCustomWidgetBySlug: db.prepare('SELECT * FROM custom_widgets WHERE slug = ?'),
  insertCustomWidget: db.prepare(`
    INSERT INTO custom_widgets (id, name, slug, description, source_code, compiled_code, default_size, min_size, data_providers, refresh_interval, enabled, server_code, server_code_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateCustomWidget: db.prepare(`
    UPDATE custom_widgets
    SET name = ?, description = ?, source_code = ?, compiled_code = ?, default_size = ?, min_size = ?, data_providers = ?, refresh_interval = ?, enabled = ?, server_code = ?, server_code_enabled = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  deleteCustomWidget: db.prepare('DELETE FROM custom_widgets WHERE id = ?'),

  // Data Providers
  getAllDataProviders: db.prepare('SELECT * FROM data_providers ORDER BY name'),
  getDataProvider: db.prepare('SELECT * FROM data_providers WHERE id = ?'),
  getDataProviderBySlug: db.prepare('SELECT * FROM data_providers WHERE slug = ?'),
  insertDataProvider: db.prepare(`
    INSERT INTO data_providers (id, name, slug, base_url, auth_type, credential_id, default_headers)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateDataProvider: db.prepare(`
    UPDATE data_providers 
    SET name = ?, base_url = ?, auth_type = ?, credential_id = ?, default_headers = ?
    WHERE id = ?
  `),
  deleteDataProvider: db.prepare('DELETE FROM data_providers WHERE id = ?'),
};

// Widget functions
export function getAllWidgets(): WidgetRow[] {
  return stmts.getAllWidgets.all() as WidgetRow[];
}

export function getWidget(id: string): WidgetRow | undefined {
  return stmts.getWidget.get(id) as WidgetRow | undefined;
}

export function createWidget(
  id: string,
  type: string,
  title: string,
  config: object,
  position: object,
  dataSource?: object,
  customWidgetId?: string
): void {
  stmts.insertWidget.run(
    id,
    type,
    title,
    JSON.stringify(config),
    JSON.stringify(position),
    dataSource ? JSON.stringify(dataSource) : null,
    customWidgetId || null
  );
  logEvent('widget_created', { id, type, title, customWidgetId });
}

export function updateWidget(
  id: string,
  title: string,
  config: object,
  position: object,
  dataSource?: object
): void {
  stmts.updateWidget.run(
    title,
    JSON.stringify(config),
    JSON.stringify(position),
    dataSource ? JSON.stringify(dataSource) : null,
    id
  );
  logEvent('widget_updated', { id });
}

export function updateWidgetData(id: string, data: object): void {
  stmts.updateWidgetData.run(JSON.stringify(data), id);
  logEvent('data_refreshed', { id });
}

export function deleteWidget(id: string): void {
  stmts.deleteWidget.run(id);
  stmts.deleteNote.run(id);
  stmts.deleteBookmarksByWidget.run(id);
  logEvent('widget_deleted', { id });
}

// Notes functions
export function getNote(widgetId: string): NoteRow | undefined {
  return stmts.getNote.get(widgetId) as NoteRow | undefined;
}

export function upsertNote(widgetId: string, content: string): void {
  stmts.upsertNote.run(widgetId, content, content);
}

// Bookmarks functions
export function getBookmarks(widgetId: string): BookmarkRow[] {
  return stmts.getBookmarks.all(widgetId) as BookmarkRow[];
}

export function createBookmark(
  id: string,
  widgetId: string,
  title: string,
  url: string,
  icon?: string,
  position?: number
): void {
  stmts.insertBookmark.run(id, widgetId, title, url, icon || null, position || 0);
}

export function updateBookmark(
  id: string,
  title: string,
  url: string,
  icon?: string,
  position?: number
): void {
  stmts.updateBookmark.run(title, url, icon || null, position || 0, id);
}

export function deleteBookmark(id: string): void {
  stmts.deleteBookmark.run(id);
}

// Settings functions
export function getSetting(key: string): string | undefined {
  const row = stmts.getSetting.get(key) as { value: string } | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string): void {
  stmts.upsertSetting.run(key, value, value);
}

// Events functions
export function logEvent(type: string, payload?: object): void {
  stmts.insertEvent.run(type, payload ? JSON.stringify(payload) : null);
}

export function getRecentEvents(limit: number = 100): EventRow[] {
  return stmts.getRecentEvents.all(limit) as EventRow[];
}

// Layout helpers
export function getLayout(): object[] {
  const widgets = getAllWidgets();
  return widgets.map((w) => ({
    i: w.id,
    ...JSON.parse(w.position),
  }));
}

export function updateLayout(layout: Array<{ i: string; x: number; y: number; w: number; h: number }>): void {
  const updatePos = db.prepare('UPDATE widgets SET position = ?, updated_at = datetime(\'now\') WHERE id = ?');
  const transaction = db.transaction((items: typeof layout) => {
    for (const item of items) {
      updatePos.run(
        JSON.stringify({ x: item.x, y: item.y, w: item.w, h: item.h }),
        item.i
      );
    }
  });
  transaction(layout);
}

// Custom Widget functions
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
  };
}

export function getAllCustomWidgets(includeDisabled = false): CustomWidget[] {
  const rows = (includeDisabled 
    ? stmts.getAllCustomWidgetsIncludingDisabled.all() 
    : stmts.getAllCustomWidgets.all()) as CustomWidgetRow[];
  return rows.map(rowToCustomWidget);
}

export function getCustomWidget(id: string): CustomWidget | undefined {
  const row = stmts.getCustomWidget.get(id) as CustomWidgetRow | undefined;
  return row ? rowToCustomWidget(row) : undefined;
}

export function getCustomWidgetBySlug(slug: string): CustomWidget | undefined {
  const row = stmts.getCustomWidgetBySlug.get(slug) as CustomWidgetRow | undefined;
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
  serverCodeEnabled: boolean = false
): void {
  stmts.insertCustomWidget.run(
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
    serverCodeEnabled ? 1 : 0
  );
  logEvent('custom_widget_created', { id, name, slug });
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
  serverCodeEnabled: boolean = false
): void {
  stmts.updateCustomWidget.run(
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
    id
  );
  logEvent('custom_widget_updated', { id, name });
}

export function deleteCustomWidget(id: string): void {
  // First, delete any widget instances that use this custom widget
  const deleteInstances = db.prepare('DELETE FROM widgets WHERE custom_widget_id = ?');
  deleteInstances.run(id);
  
  stmts.deleteCustomWidget.run(id);
  logEvent('custom_widget_deleted', { id });
}

// Data Provider functions
export interface DataProvider {
  id: string;
  name: string;
  slug: string;
  base_url: string;
  auth_type: 'bearer' | 'basic' | 'header' | 'none';
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
    auth_type: row.auth_type as DataProvider['auth_type'],
    credential_id: row.credential_id,
    default_headers: JSON.parse(row.default_headers),
    created_at: row.created_at,
  };
}

export function getAllDataProviders(): DataProvider[] {
  const rows = stmts.getAllDataProviders.all() as DataProviderRow[];
  return rows.map(rowToDataProvider);
}

export function getDataProvider(id: string): DataProvider | undefined {
  const row = stmts.getDataProvider.get(id) as DataProviderRow | undefined;
  return row ? rowToDataProvider(row) : undefined;
}

export function getDataProviderBySlug(slug: string): DataProvider | undefined {
  const row = stmts.getDataProviderBySlug.get(slug) as DataProviderRow | undefined;
  return row ? rowToDataProvider(row) : undefined;
}

export function createDataProvider(
  id: string,
  name: string,
  slug: string,
  baseUrl: string,
  authType: DataProvider['auth_type'],
  credentialId: string | null,
  defaultHeaders: Record<string, string>
): void {
  stmts.insertDataProvider.run(
    id,
    name,
    slug,
    baseUrl,
    authType,
    credentialId,
    JSON.stringify(defaultHeaders)
  );
  logEvent('data_provider_created', { id, name, slug });
}

export function updateDataProvider(
  id: string,
  name: string,
  baseUrl: string,
  authType: DataProvider['auth_type'],
  credentialId: string | null,
  defaultHeaders: Record<string, string>
): void {
  stmts.updateDataProvider.run(
    name,
    baseUrl,
    authType,
    credentialId,
    JSON.stringify(defaultHeaders),
    id
  );
  logEvent('data_provider_updated', { id, name });
}

export function deleteDataProvider(id: string): void {
  stmts.deleteDataProvider.run(id);
  logEvent('data_provider_deleted', { id });
}

export default db;
