// Widget SDK Types

export interface WidgetConfig {
  [key: string]: unknown;
}

export interface DataQuery {
  endpoint: string;
  params?: Record<string, string | number | boolean>;
  method?: 'GET' | 'POST';
  body?: unknown;
}

export interface UseDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export interface UseWidgetStateResult<T> {
  state: T;
  setState: (value: T | ((prev: T) => T)) => void;
}

// Custom Widget Definition from API
export interface CustomWidgetDefinition {
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
  enabled: boolean;
  server_code: string | null;
  server_code_enabled: boolean;
}

// Widget context for runtime execution
export interface WidgetContext {
  widgetId: string;
  config: WidgetConfig;
  refreshInterval: number;
  customWidgetSlug?: string;
  serverCodeEnabled?: boolean;
}

// Data Provider definition
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
