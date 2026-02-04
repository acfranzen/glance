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

// Fetch configuration for widget data sources
export interface FetchConfig {
  type: "server_code" | "webhook" | "agent_refresh";
  info?: string;
  webhook_path?: string;
  webhook_setup_instructions?: string;
  instructions?: string;
  expected_freshness_seconds?: number;
  max_staleness_seconds?: number;
  schedule?: string;
  refresh_endpoint?: string;  // For webhook - external endpoint to trigger refresh
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
  // Widget package fields
  fetch?: FetchConfig;
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
