export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  issues: ValidationIssue[];
}

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetDataSource {
  type: 'integration' | 'api' | 'static';
  integration?: string;
  refresh_interval?: number;
}

export interface WidgetPayload {
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: WidgetPosition;
  data_source?: WidgetDataSource;
  custom_widget_id?: string;
}

export interface WidgetUpdatePayload {
  title?: string;
  config?: Record<string, unknown>;
  position?: WidgetPosition;
  data_source?: WidgetDataSource;
}

export interface CustomWidgetSize {
  w: number;
  h: number;
}

export interface CustomWidgetPayload {
  name: string;
  slug?: string;
  description?: string | null;
  source_code: string;
  compiled_code?: string | null;
  default_size?: CustomWidgetSize;
  min_size?: CustomWidgetSize;
  data_providers?: string[];
  refresh_interval?: number;
  enabled?: boolean;
  server_code?: string | null;
  server_code_enabled?: boolean;
  required_credentials?: string[];
  runtime_profile?: 'safe' | 'networked';
  permissions?: {
    credential_providers?: string[];
    data_providers?: string[];
    allow_network?: boolean;
  };
}

export interface CustomWidgetUpdatePayload {
  name?: string;
  description?: string | null;
  source_code?: string;
  compiled_code?: string | null;
  default_size?: CustomWidgetSize;
  min_size?: CustomWidgetSize;
  data_providers?: string[];
  refresh_interval?: number;
  enabled?: boolean;
  server_code?: string | null;
  server_code_enabled?: boolean;
  required_credentials?: string[];
  runtime_profile?: 'safe' | 'networked';
  permissions?: {
    credential_providers?: string[];
    data_providers?: string[];
    allow_network?: boolean;
  };
}

const WIDGET_TYPES = new Set(['claude_max_usage', 'custom']);
const DATA_SOURCE_TYPES = new Set(['integration', 'api', 'static']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const WIDGET_TITLE_MAX = 80;
const CUSTOM_WIDGET_NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const CODE_MAX = 100_000;
const DATA_PROVIDERS_MAX = 20;
const REFRESH_INTERVAL_MIN = 15;
const REFRESH_INTERVAL_MAX = 86_400;
const GRID_W_MIN = 1;
const GRID_W_MAX = 12;
const GRID_H_MIN = 1;
const GRID_H_MAX = 24;

const CREATE_WIDGET_KEYS = new Set(['type', 'title', 'config', 'position', 'data_source', 'custom_widget_id']);
const UPDATE_WIDGET_KEYS = new Set(['title', 'config', 'position', 'data_source']);
const CUSTOM_WIDGET_CREATE_KEYS = new Set([
  'name',
  'slug',
  'description',
  'source_code',
  'compiled_code',
  'default_size',
  'min_size',
  'data_providers',
  'refresh_interval',
  'enabled',
  'server_code',
  'server_code_enabled',
  'required_credentials',
  'runtime_profile',
  'permissions',
]);
const CUSTOM_WIDGET_UPDATE_KEYS = new Set([...CUSTOM_WIDGET_CREATE_KEYS]);

const WIDGET_PAYLOAD_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://glance.dev/schema/widget-payload.json',
  type: 'object',
  additionalProperties: false,
  required: ['type', 'title', 'config', 'position'],
  properties: {
    type: { type: 'string', enum: ['claude_max_usage', 'custom'] },
    title: { type: 'string', minLength: 1, maxLength: 80 },
    config: { type: 'object', additionalProperties: true },
    position: {
      type: 'object',
      additionalProperties: false,
      required: ['x', 'y', 'w', 'h'],
      properties: {
        x: { type: 'integer', minimum: 0 },
        y: { type: 'integer', minimum: 0 },
        w: { type: 'integer', minimum: 1, maximum: 12 },
        h: { type: 'integer', minimum: 1, maximum: 24 },
      },
    },
    data_source: {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: {
        type: { type: 'string', enum: ['integration', 'api', 'static'] },
        integration: { type: 'string', minLength: 1, maxLength: 100 },
        refresh_interval: { type: 'integer', minimum: 15, maximum: 86400 },
      },
    },
    custom_widget_id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
  },
} as const;

const CUSTOM_WIDGET_PAYLOAD_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://glance.dev/schema/custom-widget-payload.json',
  type: 'object',
  additionalProperties: false,
  required: ['name', 'source_code'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 80 },
    slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    description: { type: ['string', 'null'], maxLength: 500 },
    source_code: { type: 'string', minLength: 1, maxLength: 100000 },
    compiled_code: { type: ['string', 'null'], maxLength: 100000 },
    default_size: {
      type: 'object',
      additionalProperties: false,
      required: ['w', 'h'],
      properties: {
        w: { type: 'integer', minimum: 1, maximum: 12 },
        h: { type: 'integer', minimum: 1, maximum: 24 },
      },
    },
    min_size: {
      type: 'object',
      additionalProperties: false,
      required: ['w', 'h'],
      properties: {
        w: { type: 'integer', minimum: 1, maximum: 12 },
        h: { type: 'integer', minimum: 1, maximum: 24 },
      },
    },
    data_providers: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    },
    refresh_interval: { type: 'integer', minimum: 15, maximum: 86400 },
    enabled: { type: 'boolean' },
    server_code: { type: ['string', 'null'], maxLength: 100000 },
    server_code_enabled: { type: 'boolean' },
    required_credentials: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    },
    runtime_profile: { type: 'string', enum: ['safe', 'networked'] },
    permissions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        credential_providers: {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        },
        data_providers: {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
        },
        allow_network: { type: 'boolean' },
      },
    },
  },
} as const;

export const WIDGET_CONTRACT_SCHEMAS = {
  widgetPayload: WIDGET_PAYLOAD_JSON_SCHEMA,
  customWidgetPayload: CUSTOM_WIDGET_PAYLOAD_JSON_SCHEMA,
} as const;

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function pushIssue(issues: ValidationIssue[], path: string, code: string, message: string): void {
  issues.push({ path, code, message });
}

function validateUnexpectedKeys(
  input: Record<string, unknown>,
  allowedKeys: Set<string>,
  path: string,
  issues: ValidationIssue[]
): void {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      pushIssue(issues, `${path}.${key}`, 'unexpected_property', `Unexpected property "${key}"`);
    }
  }
}

function validateString(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  opts: { min?: number; max?: number; pattern?: RegExp; nullable?: boolean }
): value is string | null {
  if (value === null && opts.nullable) {
    return true;
  }

  if (typeof value !== 'string') {
    pushIssue(issues, path, 'type', 'Expected string');
    return false;
  }

  if (opts.min !== undefined && value.length < opts.min) {
    pushIssue(issues, path, 'min_length', `Must be at least ${opts.min} characters`);
  }

  if (opts.max !== undefined && value.length > opts.max) {
    pushIssue(issues, path, 'max_length', `Must be at most ${opts.max} characters`);
  }

  if (opts.pattern && !opts.pattern.test(value)) {
    pushIssue(issues, path, 'pattern', 'Invalid format');
  }

  return true;
}

function validateSize(value: unknown, path: string, issues: ValidationIssue[]): value is CustomWidgetSize {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'type', 'Expected object');
    return false;
  }

  const allowed = new Set(['w', 'h']);
  validateUnexpectedKeys(value, allowed, path, issues);

  const w = value.w;
  const h = value.h;

  if (!isInteger(w)) {
    pushIssue(issues, `${path}.w`, 'type', 'Expected integer');
  } else if (w < GRID_W_MIN || w > GRID_W_MAX) {
    pushIssue(issues, `${path}.w`, 'range', `Must be between ${GRID_W_MIN} and ${GRID_W_MAX}`);
  }

  if (!isInteger(h)) {
    pushIssue(issues, `${path}.h`, 'type', 'Expected integer');
  } else if (h < GRID_H_MIN || h > GRID_H_MAX) {
    pushIssue(issues, `${path}.h`, 'range', `Must be between ${GRID_H_MIN} and ${GRID_H_MAX}`);
  }

  return true;
}

function validatePosition(value: unknown, path: string, issues: ValidationIssue[]): value is WidgetPosition {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'type', 'Expected object');
    return false;
  }

  const allowed = new Set(['x', 'y', 'w', 'h']);
  validateUnexpectedKeys(value, allowed, path, issues);

  const x = value.x;
  const y = value.y;
  const w = value.w;
  const h = value.h;

  if (!isInteger(x) || x < 0) {
    pushIssue(issues, `${path}.x`, 'range', 'Expected non-negative integer');
  }

  if (!isInteger(y) || y < 0) {
    pushIssue(issues, `${path}.y`, 'range', 'Expected non-negative integer');
  }

  if (!isInteger(w) || w < GRID_W_MIN || w > GRID_W_MAX) {
    pushIssue(issues, `${path}.w`, 'range', `Must be integer between ${GRID_W_MIN} and ${GRID_W_MAX}`);
  }

  if (!isInteger(h) || h < GRID_H_MIN || h > GRID_H_MAX) {
    pushIssue(issues, `${path}.h`, 'range', `Must be integer between ${GRID_H_MIN} and ${GRID_H_MAX}`);
  }

  return true;
}

function validateDataSource(value: unknown, path: string, issues: ValidationIssue[]): value is WidgetDataSource {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'type', 'Expected object');
    return false;
  }

  const allowed = new Set(['type', 'integration', 'refresh_interval']);
  validateUnexpectedKeys(value, allowed, path, issues);

  if (!DATA_SOURCE_TYPES.has(String(value.type ?? ''))) {
    pushIssue(issues, `${path}.type`, 'enum', 'Expected one of integration, api, static');
  }

  if (value.integration !== undefined) {
    validateString(value.integration, `${path}.integration`, issues, { min: 1, max: 100 });
  }

  if (value.refresh_interval !== undefined) {
    if (!isInteger(value.refresh_interval)) {
      pushIssue(issues, `${path}.refresh_interval`, 'type', 'Expected integer');
    } else if (value.refresh_interval < REFRESH_INTERVAL_MIN || value.refresh_interval > REFRESH_INTERVAL_MAX) {
      pushIssue(
        issues,
        `${path}.refresh_interval`,
        'range',
        `Must be between ${REFRESH_INTERVAL_MIN} and ${REFRESH_INTERVAL_MAX}`
      );
    }
  }

  return true;
}

function validateSlugArray(value: unknown, path: string, issues: ValidationIssue[]): value is string[] {
  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'type', 'Expected array');
    return false;
  }
  if (value.length > DATA_PROVIDERS_MAX) {
    pushIssue(issues, path, 'max_items', `At most ${DATA_PROVIDERS_MAX} entries are allowed`);
  }
  value.forEach((item, index) => {
    validateString(item, `${path}[${index}]`, issues, {
      min: 1,
      max: 100,
      pattern: SLUG_PATTERN,
    });
  });
  return true;
}

function validatePermissions(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    pushIssue(issues, path, 'type', 'Expected object');
    return;
  }

  const allowed = new Set(['credential_providers', 'data_providers', 'allow_network']);
  validateUnexpectedKeys(value, allowed, path, issues);

  if (value.credential_providers !== undefined) {
    validateSlugArray(value.credential_providers, `${path}.credential_providers`, issues);
  }
  if (value.data_providers !== undefined) {
    validateSlugArray(value.data_providers, `${path}.data_providers`, issues);
  }
  if (value.allow_network !== undefined && typeof value.allow_network !== 'boolean') {
    pushIssue(issues, `${path}.allow_network`, 'type', 'Expected boolean');
  }
}

export function validateWidgetCreatePayload(input: unknown): ValidationResult<WidgetPayload> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    pushIssue(issues, '$', 'type', 'Expected object');
    return { ok: false, issues };
  }

  validateUnexpectedKeys(input, CREATE_WIDGET_KEYS, '$', issues);

  if (!validateString(input.type, '$.type', issues, { min: 1, max: 50 })) {
    return { ok: false, issues };
  }
  if (!WIDGET_TYPES.has(String(input.type))) {
    pushIssue(issues, '$.type', 'enum', 'Unsupported widget type');
  }

  if (!validateString(input.title, '$.title', issues, { min: 1, max: WIDGET_TITLE_MAX })) {
    // continue to collect more issues
  }

  if (!isRecord(input.config)) {
    pushIssue(issues, '$.config', 'type', 'Expected object');
  }

  validatePosition(input.position, '$.position', issues);

  if (input.data_source !== undefined) {
    validateDataSource(input.data_source, '$.data_source', issues);
  }

  if (input.custom_widget_id !== undefined) {
    validateString(input.custom_widget_id, '$.custom_widget_id', issues, {
      min: 1,
      max: 100,
      pattern: SAFE_ID_PATTERN,
    });
  }

  if (input.type === 'custom' && !input.custom_widget_id) {
    pushIssue(issues, '$.custom_widget_id', 'required', 'Required when type is "custom"');
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues,
    value: {
      type: input.type as string,
      title: input.title as string,
      config: input.config as Record<string, unknown>,
      position: input.position as WidgetPosition,
      data_source: input.data_source as WidgetDataSource | undefined,
      custom_widget_id: input.custom_widget_id as string | undefined,
    },
  };
}

export function validateWidgetUpdatePayload(input: unknown): ValidationResult<WidgetUpdatePayload> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    pushIssue(issues, '$', 'type', 'Expected object');
    return { ok: false, issues };
  }

  validateUnexpectedKeys(input, UPDATE_WIDGET_KEYS, '$', issues);

  if (Object.keys(input).length === 0) {
    pushIssue(issues, '$', 'required', 'At least one field must be provided');
  }

  if (input.title !== undefined) {
    validateString(input.title, '$.title', issues, { min: 1, max: WIDGET_TITLE_MAX });
  }

  if (input.config !== undefined && !isRecord(input.config)) {
    pushIssue(issues, '$.config', 'type', 'Expected object');
  }

  if (input.position !== undefined) {
    validatePosition(input.position, '$.position', issues);
  }

  if (input.data_source !== undefined) {
    validateDataSource(input.data_source, '$.data_source', issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues,
    value: {
      title: input.title as string | undefined,
      config: input.config as Record<string, unknown> | undefined,
      position: input.position as WidgetPosition | undefined,
      data_source: input.data_source as WidgetDataSource | undefined,
    },
  };
}

export function validateStoredWidgetPayload(input: unknown): ValidationResult<WidgetPayload> {
  return validateWidgetCreatePayload(input);
}

export function validateCustomWidgetCreatePayload(input: unknown): ValidationResult<CustomWidgetPayload> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    pushIssue(issues, '$', 'type', 'Expected object');
    return { ok: false, issues };
  }

  validateUnexpectedKeys(input, CUSTOM_WIDGET_CREATE_KEYS, '$', issues);

  validateString(input.name, '$.name', issues, { min: 1, max: CUSTOM_WIDGET_NAME_MAX });

  if (input.slug !== undefined) {
    validateString(input.slug, '$.slug', issues, { min: 1, max: 100, pattern: SLUG_PATTERN });
  }

  if (input.description !== undefined) {
    validateString(input.description, '$.description', issues, { max: DESCRIPTION_MAX, nullable: true });
  }

  validateString(input.source_code, '$.source_code', issues, { min: 1, max: CODE_MAX });

  if (input.compiled_code !== undefined) {
    validateString(input.compiled_code, '$.compiled_code', issues, { max: CODE_MAX, nullable: true });
  }

  if (input.default_size !== undefined) {
    validateSize(input.default_size, '$.default_size', issues);
  }

  if (input.min_size !== undefined) {
    validateSize(input.min_size, '$.min_size', issues);
  }

  if (input.default_size && input.min_size && isRecord(input.default_size) && isRecord(input.min_size)) {
    const defaultW = input.default_size.w;
    const defaultH = input.default_size.h;
    const minW = input.min_size.w;
    const minH = input.min_size.h;

    if (isInteger(defaultW) && isInteger(minW) && minW > defaultW) {
      pushIssue(issues, '$.min_size.w', 'range', 'min_size.w cannot exceed default_size.w');
    }
    if (isInteger(defaultH) && isInteger(minH) && minH > defaultH) {
      pushIssue(issues, '$.min_size.h', 'range', 'min_size.h cannot exceed default_size.h');
    }
  }

  if (input.data_providers !== undefined) {
    validateSlugArray(input.data_providers, '$.data_providers', issues);
  }

  if (input.refresh_interval !== undefined) {
    if (!isInteger(input.refresh_interval)) {
      pushIssue(issues, '$.refresh_interval', 'type', 'Expected integer');
    } else if (input.refresh_interval < REFRESH_INTERVAL_MIN || input.refresh_interval > REFRESH_INTERVAL_MAX) {
      pushIssue(
        issues,
        '$.refresh_interval',
        'range',
        `Must be between ${REFRESH_INTERVAL_MIN} and ${REFRESH_INTERVAL_MAX}`
      );
    }
  }

  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    pushIssue(issues, '$.enabled', 'type', 'Expected boolean');
  }

  if (input.server_code !== undefined) {
    validateString(input.server_code, '$.server_code', issues, { max: CODE_MAX, nullable: true });
  }

  if (input.server_code_enabled !== undefined && typeof input.server_code_enabled !== 'boolean') {
    pushIssue(issues, '$.server_code_enabled', 'type', 'Expected boolean');
  }

  if (input.server_code_enabled === true && !input.server_code) {
    pushIssue(issues, '$.server_code', 'required', 'server_code is required when server_code_enabled is true');
  }

  if (input.required_credentials !== undefined) {
    validateSlugArray(input.required_credentials, '$.required_credentials', issues);
  }

  if (input.runtime_profile !== undefined && input.runtime_profile !== 'safe' && input.runtime_profile !== 'networked') {
    pushIssue(issues, '$.runtime_profile', 'enum', 'Expected one of safe, networked');
  }

  if (input.permissions !== undefined) {
    validatePermissions(input.permissions, '$.permissions', issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues,
    value: {
      name: input.name as string,
      slug: input.slug as string | undefined,
      description: input.description as string | null | undefined,
      source_code: input.source_code as string,
      compiled_code: input.compiled_code as string | null | undefined,
      default_size: input.default_size as CustomWidgetSize | undefined,
      min_size: input.min_size as CustomWidgetSize | undefined,
      data_providers: input.data_providers as string[] | undefined,
      refresh_interval: input.refresh_interval as number | undefined,
      enabled: input.enabled as boolean | undefined,
      server_code: input.server_code as string | null | undefined,
      server_code_enabled: input.server_code_enabled as boolean | undefined,
      required_credentials: input.required_credentials as string[] | undefined,
      runtime_profile: input.runtime_profile as 'safe' | 'networked' | undefined,
      permissions: input.permissions as CustomWidgetPayload['permissions'] | undefined,
    },
  };
}

export function validateCustomWidgetUpdatePayload(input: unknown): ValidationResult<CustomWidgetUpdatePayload> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(input)) {
    pushIssue(issues, '$', 'type', 'Expected object');
    return { ok: false, issues };
  }

  validateUnexpectedKeys(input, CUSTOM_WIDGET_UPDATE_KEYS, '$', issues);

  if (Object.keys(input).length === 0) {
    pushIssue(issues, '$', 'required', 'At least one field must be provided');
  }

  if (input.name !== undefined) {
    validateString(input.name, '$.name', issues, { min: 1, max: CUSTOM_WIDGET_NAME_MAX });
  }

  if (input.description !== undefined) {
    validateString(input.description, '$.description', issues, { max: DESCRIPTION_MAX, nullable: true });
  }

  if (input.source_code !== undefined) {
    validateString(input.source_code, '$.source_code', issues, { min: 1, max: CODE_MAX });
  }

  if (input.compiled_code !== undefined) {
    validateString(input.compiled_code, '$.compiled_code', issues, { max: CODE_MAX, nullable: true });
  }

  if (input.default_size !== undefined) {
    validateSize(input.default_size, '$.default_size', issues);
  }

  if (input.min_size !== undefined) {
    validateSize(input.min_size, '$.min_size', issues);
  }

  if (input.data_providers !== undefined) {
    validateSlugArray(input.data_providers, '$.data_providers', issues);
  }

  if (input.refresh_interval !== undefined) {
    if (!isInteger(input.refresh_interval)) {
      pushIssue(issues, '$.refresh_interval', 'type', 'Expected integer');
    } else if (input.refresh_interval < REFRESH_INTERVAL_MIN || input.refresh_interval > REFRESH_INTERVAL_MAX) {
      pushIssue(
        issues,
        '$.refresh_interval',
        'range',
        `Must be between ${REFRESH_INTERVAL_MIN} and ${REFRESH_INTERVAL_MAX}`
      );
    }
  }

  if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
    pushIssue(issues, '$.enabled', 'type', 'Expected boolean');
  }

  if (input.server_code !== undefined) {
    validateString(input.server_code, '$.server_code', issues, { max: CODE_MAX, nullable: true });
  }

  if (input.server_code_enabled !== undefined && typeof input.server_code_enabled !== 'boolean') {
    pushIssue(issues, '$.server_code_enabled', 'type', 'Expected boolean');
  }

  if (input.server_code_enabled === true && input.server_code === null) {
    pushIssue(issues, '$.server_code', 'required', 'server_code cannot be null when server_code_enabled is true');
  }

  if (input.required_credentials !== undefined) {
    validateSlugArray(input.required_credentials, '$.required_credentials', issues);
  }

  if (input.runtime_profile !== undefined && input.runtime_profile !== 'safe' && input.runtime_profile !== 'networked') {
    pushIssue(issues, '$.runtime_profile', 'enum', 'Expected one of safe, networked');
  }

  if (input.permissions !== undefined) {
    validatePermissions(input.permissions, '$.permissions', issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues,
    value: input as CustomWidgetUpdatePayload,
  };
}

export function validateStoredCustomWidgetPayload(input: unknown): ValidationResult<CustomWidgetPayload> {
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [{ path: '$', code: 'type', message: 'Expected object' }],
    };
  }

  const candidate: CustomWidgetPayload = {
    name: input.name as string,
    slug: input.slug as string | undefined,
    description: input.description as string | null | undefined,
    source_code: input.source_code as string,
    compiled_code: input.compiled_code as string | null | undefined,
    default_size: input.default_size as CustomWidgetSize | undefined,
    min_size: input.min_size as CustomWidgetSize | undefined,
    data_providers: input.data_providers as string[] | undefined,
    refresh_interval: input.refresh_interval as number | undefined,
    enabled: input.enabled as boolean | undefined,
    server_code: input.server_code as string | null | undefined,
    server_code_enabled: input.server_code_enabled as boolean | undefined,
    required_credentials: input.required_credentials as string[] | undefined,
    runtime_profile: input.runtime_profile as 'safe' | 'networked' | undefined,
    permissions: input.permissions as CustomWidgetPayload['permissions'] | undefined,
  };

  return validateCustomWidgetCreatePayload(candidate);
}
