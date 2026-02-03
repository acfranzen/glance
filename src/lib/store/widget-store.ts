'use client';

import { create } from 'zustand';
import type { Widget } from '@/types/api';
import type { WidgetType } from '@/types/widget';

interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface WidgetState {
  widgets: Widget[];
  layout: LayoutItem[];
  isEditing: boolean;
  isLoading: boolean;
  initialized: boolean;
}

interface WidgetActions {
  initialize: () => Promise<void>;
  refreshWidgets: () => Promise<void>;
  setEditing: (editing: boolean) => void;
  addWidget: (type: WidgetType, title?: string) => Promise<void>;
  addCustomWidget: (customWidgetId: string, title: string, defaultSize?: { w: number; h: number }) => Promise<void>;
  removeWidget: (widgetId: string) => Promise<void>;
  updateWidget: (widgetId: string, updates: Partial<Widget>) => Promise<void>;
  updateLayout: (layout: LayoutItem[]) => Promise<void>;
  reset: () => void;
}

type WidgetStore = WidgetState & WidgetActions;

const DEFAULT_SIZES: Record<string, { w: number; h: number; minW: number; minH: number }> = {
  claude_max_usage: { w: 4, h: 3, minW: 3, minH: 2 },
  custom: { w: 4, h: 3, minW: 2, minH: 2 },
};

export const useWidgetStore = create<WidgetStore>()((set, get) => ({
  widgets: [],
  layout: [],
  isEditing: false,
  isLoading: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized) return;

    set({ isLoading: true });

    try {
      const response = await fetch('/api/widgets');
      if (!response.ok) throw new Error('Failed to fetch widgets');
      
      const data = await response.json();
      const widgets: Widget[] = data.widgets || [];
      
      // Build layout from widget positions
      const layout: LayoutItem[] = widgets.map((w: Widget) => ({
        i: w.id,
        x: w.position?.x || 0,
        y: w.position?.y || 0,
        w: w.position?.w || DEFAULT_SIZES[w.type]?.w || 3,
        h: w.position?.h || DEFAULT_SIZES[w.type]?.h || 2,
        minW: DEFAULT_SIZES[w.type]?.minW || 2,
        minH: DEFAULT_SIZES[w.type]?.minH || 2,
      }));

      set({
        widgets,
        layout,
        initialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize widgets:', error);
      set({ isLoading: false, initialized: true });
    }
  },

  refreshWidgets: async () => {
    set({ isLoading: true });

    try {
      const response = await fetch('/api/widgets');
      if (!response.ok) throw new Error('Failed to fetch widgets');
      
      const data = await response.json();
      const widgets: Widget[] = data.widgets || [];
      
      // Build layout from widget positions
      const layout: LayoutItem[] = widgets.map((w: Widget) => ({
        i: w.id,
        x: w.position?.x || 0,
        y: w.position?.y || 0,
        w: w.position?.w || DEFAULT_SIZES[w.type]?.w || 3,
        h: w.position?.h || DEFAULT_SIZES[w.type]?.h || 2,
        minW: DEFAULT_SIZES[w.type]?.minW || 2,
        minH: DEFAULT_SIZES[w.type]?.minH || 2,
      }));

      set({
        widgets,
        layout,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to refresh widgets:', error);
      set({ isLoading: false });
    }
  },

  setEditing: (editing: boolean) => {
    set({ isEditing: editing });
  },

  addWidget: async (type, title) => {
    const { layout } = get();
    const sizes = DEFAULT_SIZES[type] || { w: 3, h: 2, minW: 2, minH: 2 };
    
    // Find the lowest y position to place new widget at bottom
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          title: title || type,
          config: {},
          position: { x: 0, y: maxY, w: sizes.w, h: sizes.h },
        }),
      });

      if (!response.ok) throw new Error('Failed to create widget');
      
      const widget: Widget = await response.json();
      
      const newLayoutItem: LayoutItem = {
        i: widget.id,
        x: widget.position?.x || 0,
        y: widget.position?.y || maxY,
        w: widget.position?.w || sizes.w,
        h: widget.position?.h || sizes.h,
        minW: sizes.minW,
        minH: sizes.minH,
      };

      set((state) => ({
        widgets: [...state.widgets, widget],
        layout: [...state.layout, newLayoutItem],
      }));
    } catch (error) {
      console.error('Failed to add widget:', error);
    }
  },

  addCustomWidget: async (customWidgetId, title, defaultSize) => {
    const { layout } = get();
    const sizes = defaultSize 
      ? { ...defaultSize, minW: 2, minH: 2 } 
      : DEFAULT_SIZES.custom;
    
    // Find the lowest y position to place new widget at bottom
    const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

    try {
      const response = await fetch('/api/widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'custom',
          title,
          config: {},
          position: { x: 0, y: maxY, w: sizes.w, h: sizes.h },
          custom_widget_id: customWidgetId,
        }),
      });

      if (!response.ok) throw new Error('Failed to create custom widget');
      
      const widget: Widget = await response.json();
      
      const newLayoutItem: LayoutItem = {
        i: widget.id,
        x: widget.position?.x || 0,
        y: widget.position?.y || maxY,
        w: widget.position?.w || sizes.w,
        h: widget.position?.h || sizes.h,
        minW: sizes.minW,
        minH: sizes.minH,
      };

      set((state) => ({
        widgets: [...state.widgets, widget],
        layout: [...state.layout, newLayoutItem],
      }));
    } catch (error) {
      console.error('Failed to add custom widget:', error);
      throw error;
    }
  },

  removeWidget: async (widgetId: string) => {
    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete widget');

      set((state) => ({
        widgets: state.widgets.filter((w) => w.id !== widgetId),
        layout: state.layout.filter((l) => l.i !== widgetId),
      }));
    } catch (error) {
      console.error('Failed to remove widget:', error);
    }
  },

  updateWidget: async (widgetId: string, updates: Partial<Widget>) => {
    try {
      const response = await fetch(`/api/widgets/${widgetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update widget');
      
      const updated: Widget = await response.json();

      set((state) => ({
        widgets: state.widgets.map((w) =>
          w.id === widgetId ? { ...w, ...updated } : w
        ),
      }));
    } catch (error) {
      console.error('Failed to update widget:', error);
    }
  },

  updateLayout: async (newLayout: LayoutItem[]) => {
    set({ layout: newLayout });

    // Update each widget's position in the backend
    const { widgets } = get();
    
    for (const item of newLayout) {
      const widget = widgets.find((w) => w.id === item.i);
      if (widget) {
        const position: Position = { x: item.x, y: item.y, w: item.w, h: item.h };
        try {
          await fetch(`/api/widgets/${widget.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ position }),
          });
        } catch (error) {
          console.error('Failed to save layout:', error);
        }
      }
    }
  },

  reset: () => {
    set({
      widgets: [],
      layout: [],
      isEditing: false,
      isLoading: false,
      initialized: false,
    });
  },
}));
