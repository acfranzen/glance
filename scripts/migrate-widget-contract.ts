import Database from 'better-sqlite3';
import path from 'path';
import {
  validateStoredWidgetPayload,
  validateStoredCustomWidgetPayload,
  type ValidationIssue,
  type WidgetDataSource,
  type WidgetPosition,
  type CustomWidgetSize,
} from '../src/lib/widget-contract.ts';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'glance.db');
const db = new Database(DB_PATH);

const WIDGET_TYPES = new Set(['claude_max_usage', 'custom']);
const DATA_SOURCE_TYPES = new Set(['integration', 'api', 'static']);
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type JsonObject = Record<string, unknown>;

type WidgetRow = {
  id: unknown;
  type: unknown;
  title: unknown;
  config: unknown;
  position: unknown;
  data_source: unknown;
  custom_widget_id: unknown;
};

type CustomWidgetRow = {
  id: unknown;
  name: unknown;
  slug: unknown;
  description: unknown;
  source_code: unknown;
  compiled_code: unknown;
  default_size: unknown;
  min_size: unknown;
  data_providers: unknown;
  refresh_interval: unknown;
  enabled: unknown;
  server_code: unknown;
  server_code_enabled: unknown;
};

type WidgetComparable = {
  type: unknown;
  title: unknown;
  config: unknown;
  position: unknown;
  data_source: unknown;
  custom_widget_id: unknown;
};

type CustomWidgetComparable = {
  name: unknown;
  slug: unknown;
  description: unknown;
  source_code: unknown;
  compiled_code: unknown;
  default_size: unknown;
  min_size: unknown;
  data_providers: unknown;
  refresh_interval: unknown;
  enabled: unknown;
  server_code: unknown;
  server_code_enabled: unknown;
};

type ChangeSummary = {
  id: string;
  changed_fields: string[];
};

type UnrecoverableRecord = {
  table: 'widgets' | 'custom_widgets';
  id: string;
  issues: ValidationIssue[];
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
  const n = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function asRecord(value: unknown, fallback: JsonObject = {}): JsonObject {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return fallback;
}

function normalizeTitle(value: unknown, fallback: string): string {
  const input = typeof value === 'string' ? value.trim() : '';
  const chosen = input.length > 0 ? input : fallback;
  return chosen.slice(0, 80);
}

function normalizeWidgetPosition(value: unknown): WidgetPosition {
  const input = asRecord(value);
  return {
    x: clampInt(input.x, 0, Number.MAX_SAFE_INTEGER, 0),
    y: clampInt(input.y, 0, Number.MAX_SAFE_INTEGER, 0),
    w: clampInt(input.w, 1, 12, 4),
    h: clampInt(input.h, 1, 24, 3),
  };
}

function normalizeDataSource(value: unknown): WidgetDataSource | undefined {
  if (value == null) return undefined;
  const input = asRecord(value, {});

  const type = DATA_SOURCE_TYPES.has(String(input.type))
    ? (String(input.type) as WidgetDataSource['type'])
    : 'static';
  const out: WidgetDataSource = { type };

  if (typeof input.integration === 'string' && input.integration.trim().length > 0) {
    out.integration = input.integration.trim().slice(0, 100);
  }

  if (input.refresh_interval !== undefined) {
    out.refresh_interval = clampInt(input.refresh_interval, 15, 86400, 300);
  }

  return out;
}

function normalizeWidgetType(rawType: unknown, customWidgetId: unknown): 'claude_max_usage' | 'custom' {
  const type = typeof rawType === 'string' ? rawType : '';
  if (WIDGET_TYPES.has(type)) return type as 'claude_max_usage' | 'custom';
  if (typeof customWidgetId === 'string' && SAFE_ID_PATTERN.test(customWidgetId)) return 'custom';
  return 'claude_max_usage';
}

function toSlug(value: unknown, fallback: string): string {
  const base = (typeof value === 'string' && value.trim().length > 0 ? value : fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

function normalizeSize(value: unknown, fallback: CustomWidgetSize): CustomWidgetSize {
  const input = asRecord(value);
  return {
    w: clampInt(input.w, 1, 12, fallback.w),
    h: clampInt(input.h, 1, 24, fallback.h),
  };
}

function asRowId(value: unknown): string {
  return typeof value === 'string' ? value : String(value ?? '');
}

function changedFields<T extends Record<string, unknown>>(original: T, next: T): string[] {
  return (Object.keys(next) as Array<keyof T>).filter((key) => original[key] !== next[key]).map(String);
}

const widgetRows = db
  .prepare<[], WidgetRow>(
    'SELECT id, type, title, config, position, data_source, custom_widget_id FROM widgets ORDER BY created_at'
  )
  .all();
const customWidgetRows = db
  .prepare<[], CustomWidgetRow>(
    'SELECT id, name, slug, description, source_code, compiled_code, default_size, min_size, data_providers, refresh_interval, enabled, server_code, server_code_enabled FROM custom_widgets ORDER BY created_at'
  )
  .all();

const customWidgetIdList = customWidgetRows
  .map((row) => (typeof row.id === 'string' ? row.id : null))
  .filter((id): id is string => id !== null);
const customWidgetIds = new Set(customWidgetIdList);
const fallbackCustomWidgetId = customWidgetIdList[0];

const usedSlugs = new Set<string>();
const widgetChanges: ChangeSummary[] = [];
const customWidgetChanges: ChangeSummary[] = [];
const unrecoverable: UnrecoverableRecord[] = [];

const updateWidgetStmt = db.prepare(
  "UPDATE widgets SET type = ?, title = ?, config = ?, position = ?, data_source = ?, custom_widget_id = ?, updated_at = datetime('now') WHERE id = ?"
);
const updateCustomWidgetStmt = db.prepare(
  "UPDATE custom_widgets SET name = ?, slug = ?, description = ?, source_code = ?, compiled_code = ?, default_size = ?, min_size = ?, data_providers = ?, refresh_interval = ?, enabled = ?, server_code = ?, server_code_enabled = ?, updated_at = datetime('now') WHERE id = ?"
);

const migrate = db.transaction(() => {
  for (const row of widgetRows) {
    const rowId = asRowId(row.id);

    const original: WidgetComparable = {
      type: row.type,
      title: row.title,
      config: row.config,
      position: row.position,
      data_source: row.data_source,
      custom_widget_id: row.custom_widget_id,
    };

    const parsedConfig = asRecord(parseJson<unknown>(row.config, {}));
    const parsedPosition = parseJson<unknown>(row.position, {});
    const parsedDataSource = parseJson<unknown>(row.data_source, undefined);

    let customWidgetId =
      typeof row.custom_widget_id === 'string' && SAFE_ID_PATTERN.test(row.custom_widget_id)
        ? row.custom_widget_id
        : undefined;
    let type = normalizeWidgetType(row.type, customWidgetId);

    if (type === 'custom') {
      if (!customWidgetId || !customWidgetIds.has(customWidgetId)) {
        customWidgetId = fallbackCustomWidgetId;
      }
      if (!customWidgetId) {
        type = 'claude_max_usage';
      }
    } else {
      customWidgetId = undefined;
    }

    const normalized = {
      type,
      title: normalizeTitle(row.title, type === 'custom' ? 'Custom Widget' : 'Claude Max Usage'),
      config: parsedConfig,
      position: normalizeWidgetPosition(parsedPosition),
      data_source: normalizeDataSource(parsedDataSource),
      custom_widget_id: customWidgetId,
    };

    const validation = validateStoredWidgetPayload(normalized);
    if (!validation.ok || !validation.value) {
      unrecoverable.push({ table: 'widgets', id: rowId, issues: validation.issues });
      continue;
    }

    const next: WidgetComparable = {
      type: validation.value.type,
      title: validation.value.title,
      config: JSON.stringify(validation.value.config),
      position: JSON.stringify(validation.value.position),
      data_source:
        validation.value.data_source === undefined ? null : JSON.stringify(validation.value.data_source),
      custom_widget_id: validation.value.custom_widget_id ?? null,
    };

    widgetChanges.push({ id: rowId, changed_fields: changedFields(original, next) });

    updateWidgetStmt.run(
      next.type,
      next.title,
      next.config,
      next.position,
      next.data_source,
      next.custom_widget_id,
      rowId
    );
  }

  for (const row of customWidgetRows) {
    const rowId = asRowId(row.id);

    const original: CustomWidgetComparable = {
      name: row.name,
      slug: row.slug,
      description: row.description,
      source_code: row.source_code,
      compiled_code: row.compiled_code,
      default_size: row.default_size,
      min_size: row.min_size,
      data_providers: row.data_providers,
      refresh_interval: row.refresh_interval,
      enabled: row.enabled,
      server_code: row.server_code,
      server_code_enabled: row.server_code_enabled,
    };

    const fallbackName = `Custom Widget ${rowId.slice(-6)}`;
    const name = normalizeTitle(row.name, fallbackName);

    let slugBase = toSlug(row.slug, toSlug(name, 'custom-widget'));
    if (!SLUG_PATTERN.test(slugBase)) slugBase = 'custom-widget';
    let slug = slugBase.slice(0, 100);
    let suffix = 2;
    while (usedSlugs.has(slug)) {
      const candidate = `${slugBase.slice(0, Math.max(1, 97))}-${suffix}`;
      slug = candidate.slice(0, 100);
      suffix += 1;
    }
    usedSlugs.add(slug);

    const description =
      row.description === null ? null : typeof row.description === 'string' ? row.description.slice(0, 500) : null;
    const sourceCode =
      typeof row.source_code === 'string' && row.source_code.trim().length > 0
        ? row.source_code.slice(0, 100000)
        : 'function Widget() { return null; }';
    const compiledCode = row.compiled_code == null ? null : String(row.compiled_code).slice(0, 100000);

    const defaultSize = normalizeSize(parseJson<unknown>(row.default_size, { w: 4, h: 3 }), { w: 4, h: 3 });
    const minSize = normalizeSize(parseJson<unknown>(row.min_size, { w: 2, h: 2 }), { w: 2, h: 2 });
    if (minSize.w > defaultSize.w) minSize.w = defaultSize.w;
    if (minSize.h > defaultSize.h) minSize.h = defaultSize.h;

    const parsedProviders = parseJson<unknown>(row.data_providers, []);
    const providersRaw = Array.isArray(parsedProviders) ? parsedProviders : [];
    const dataProviders = providersRaw
      .map((p: unknown) => String(p).trim().toLowerCase())
      .filter((p: string) => SLUG_PATTERN.test(p))
      .slice(0, 20);

    const refreshInterval = clampInt(row.refresh_interval, 15, 86400, 300);
    const enabled = row.enabled === 1;
    const serverCode = row.server_code == null ? null : String(row.server_code).slice(0, 100000);
    const serverCodeEnabled = row.server_code_enabled === 1 && !!serverCode;

    const normalized = {
      name,
      slug,
      description,
      source_code: sourceCode,
      compiled_code: compiledCode,
      default_size: defaultSize,
      min_size: minSize,
      data_providers: dataProviders,
      refresh_interval: refreshInterval,
      enabled,
      server_code: serverCode,
      server_code_enabled: serverCodeEnabled,
    };

    const validation = validateStoredCustomWidgetPayload(normalized);
    if (!validation.ok || !validation.value) {
      unrecoverable.push({ table: 'custom_widgets', id: rowId, issues: validation.issues });
      continue;
    }

    const next: CustomWidgetComparable = {
      name: validation.value.name,
      slug: validation.value.slug ?? slug,
      description: validation.value.description ?? null,
      source_code: validation.value.source_code,
      compiled_code: validation.value.compiled_code ?? null,
      default_size: JSON.stringify(validation.value.default_size ?? { w: 4, h: 3 }),
      min_size: JSON.stringify(validation.value.min_size ?? { w: 2, h: 2 }),
      data_providers: JSON.stringify(validation.value.data_providers ?? []),
      refresh_interval: validation.value.refresh_interval ?? 300,
      enabled: validation.value.enabled ? 1 : 0,
      server_code: validation.value.server_code ?? null,
      server_code_enabled: validation.value.server_code_enabled ? 1 : 0,
    };

    customWidgetChanges.push({ id: rowId, changed_fields: changedFields(original, next) });

    updateCustomWidgetStmt.run(
      next.name,
      next.slug,
      next.description,
      next.source_code,
      next.compiled_code,
      next.default_size,
      next.min_size,
      next.data_providers,
      next.refresh_interval,
      next.enabled,
      next.server_code,
      next.server_code_enabled,
      rowId
    );
  }
});

migrate();

const summary = {
  db_path: DB_PATH,
  widgets_total: widgetRows.length,
  custom_widgets_total: customWidgetRows.length,
  widgets_rewritten: widgetChanges.length,
  custom_widgets_rewritten: customWidgetChanges.length,
  widgets_materially_changed: widgetChanges.filter((x) => x.changed_fields.length > 0).length,
  custom_widgets_materially_changed: customWidgetChanges.filter((x) => x.changed_fields.length > 0).length,
  widget_changes: widgetChanges,
  custom_widget_changes: customWidgetChanges,
  unrecoverable,
};

console.log(JSON.stringify(summary, null, 2));

if (unrecoverable.length > 0) {
  process.exitCode = 1;
}
