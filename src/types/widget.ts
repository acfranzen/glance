export type WidgetType = 'claude_max_usage' | 'custom';

export interface WidgetConfig {
  // Clock widget
  showSeconds?: boolean;
  use24Hour?: boolean;
  showDate?: boolean;
  
  // Weather widget
  location?: string;
  units?: 'metric' | 'imperial';
  
  // Notes widget
  // (content stored in database)
  
  // Bookmarks widget
  // (bookmarks stored in database)
  
  // Calendar widget
  calendarId?: string;
  
  // Tasks widget
  projectId?: string;
  
  // Habits widget
  habits?: Array<{ id: string; name: string; color: string }>;
  
  // Focus timer widget
  focusDuration?: number; // minutes
  breakDuration?: number; // minutes
  
  // Quote widget
  category?: 'motivational' | 'stoic' | 'wisdom' | 'random';
  
  // Custom widget config - passed to the widget code
  [key: string]: unknown;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  custom_widget_id?: string; // Reference to custom_widgets.id for type='custom'
}

export interface WidgetLayout {
  i: string; // widget id
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardState {
  widgets: Widget[];
  layout: WidgetLayout[];
}

export interface WidgetDefinition {
  type: WidgetType;
  name: string;
  description: string;
  icon: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
  maxSize?: { w: number; h: number };
}

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    type: 'claude_max_usage',
    name: 'Claude Max Usage',
    description: 'Claude Max subscription usage and limits',
    icon: 'Zap',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
  },
];
