// Bot-parseable widget data types

export interface ChartData {
  chart_type: 'line' | 'bar' | 'pie' | 'area';
  series: Array<{
    label: string;
    data: Array<{ x: string | number; y: number }>;
    color?: string;
  }>;
  x_axis: { label: string; type: 'date' | 'category' | 'number' };
  y_axis: { label: string; type: 'number' };
  annotations?: Array<{ x: string; label: string }>;
}

export interface StatData {
  value: number | string;
  label: string;
  previous_value?: number;
  change?: number;
  change_pct?: number;
  trend?: 'up' | 'down' | 'stable';
  sparkline?: number[];
}

export interface ListData {
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    status?: string;
    priority?: 'high' | 'medium' | 'low';
    timestamp?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }>;
  total_count: number;
  showing: number;
}

export interface TableData {
  columns: Array<{ key: string; label: string; type: string }>;
  rows: Array<Record<string, unknown>>;
  total_rows: number;
  aggregations?: Record<string, number>;
}

export interface TextData {
  content: string;
  format: 'plain' | 'markdown' | 'html';
}

export interface ClockData {
  time: string;
  date: string;
  timezone: string;
  timestamp: string;
}

export interface WeatherData {
  location: string;
  current: {
    temp: number;
    feels_like: number;
    condition: string;
    icon: string;
    humidity: number;
    wind_speed: number;
  };
  forecast?: Array<{
    date: string;
    high: number;
    low: number;
    condition: string;
    icon: string;
  }>;
}

export interface BookmarksData {
  bookmarks: Array<{
    id: string;
    title: string;
    url: string;
    icon?: string;
  }>;
  total_count: number;
}

export interface NotesData {
  content: string;
  word_count: number;
  char_count: number;
  updated_at: string;
}

export interface AnthropicUsageData {
  totalCost: number;
  budgetLimit: number | null;
  usagePercent: number | null;
  billingPeriod: {
    start: string;
    end: string;
    resetDate: string;
  };
  modelBreakdown: Array<{
    model: string;
    cost: number;
    inputTokens: number;
    outputTokens: number;
  }>;
  lastUpdated: string;
  error?: string;
}

export type WidgetDataPayload = 
  | ChartData 
  | StatData 
  | ListData 
  | TableData 
  | TextData
  | ClockData
  | WeatherData
  | BookmarksData
  | NotesData
  | AnthropicUsageData;

export interface WidgetDataSummary {
  narrative: string;
  trend?: 'up' | 'down' | 'stable';
  change_pct?: number;
  key_points?: string[];
}

export interface WidgetData {
  widget_id: string;
  type: string;
  title: string;
  updated_at: string;
  data: WidgetDataPayload;
  summary: WidgetDataSummary;
}

// API request/response types
export interface CreateWidgetRequest {
  type: string;
  title: string;
  config?: Record<string, unknown>;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  data_source?: {
    type: 'integration' | 'api' | 'static';
    integration?: string;
    refresh_interval?: number;
  };
  custom_widget_id?: string; // For type='custom', reference to custom widget definition
}

export interface UpdateWidgetRequest {
  title?: string;
  config?: Record<string, unknown>;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  data_source?: {
    type: 'integration' | 'api' | 'static';
    integration?: string;
    refresh_interval?: number;
  };
}

export interface Widget {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown>;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  data_source?: {
    type: 'integration' | 'api' | 'static';
    integration?: string;
    refresh_interval?: number;
  };
  custom_widget_id?: string; // For type='custom', reference to custom widget definition
  created_at: string;
  updated_at: string;
}

export interface GridLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardSnapshot {
  timestamp: string;
  widgets: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    key_points?: string[];
  }>;
}
