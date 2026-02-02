import { WidgetRow, getNote, getBookmarks } from './db';
import type {
  WidgetData,
  WidgetDataPayload,
  WidgetDataSummary,
  ClockData,
  WeatherData,
  NotesData,
  BookmarksData,
  StatData,
  TextData,
  AnthropicUsageData,
} from '@/types/api';

/**
 * Generate bot-parseable data for a widget
 */
export async function getWidgetData(widget: WidgetRow): Promise<WidgetData> {
  const config = JSON.parse(widget.config || '{}');
  const dataCache = widget.data_cache ? JSON.parse(widget.data_cache) : null;

  let data: WidgetDataPayload;
  let summary: WidgetDataSummary;

  switch (widget.type) {
    case 'clock':
      const clockResult = getClockData(config);
      data = clockResult.data;
      summary = clockResult.summary;
      break;

    case 'weather':
      const weatherResult = await getWeatherWidgetData(config, dataCache);
      data = weatherResult.data;
      summary = weatherResult.summary;
      break;

    case 'notes':
      const notesResult = getNotesWidgetData(widget.id);
      data = notesResult.data;
      summary = notesResult.summary;
      break;

    case 'bookmarks':
      const bookmarksResult = getBookmarksWidgetData(widget.id);
      data = bookmarksResult.data;
      summary = bookmarksResult.summary;
      break;

    case 'stat_card':
      const statResult = getStatCardData(config, dataCache);
      data = statResult.data;
      summary = statResult.summary;
      break;

    case 'markdown':
      const markdownResult = getMarkdownData(config);
      data = markdownResult.data;
      summary = markdownResult.summary;
      break;

    case 'anthropic_usage':
      const anthropicResult = await getAnthropicUsageData(dataCache);
      data = anthropicResult.data;
      summary = anthropicResult.summary;
      break;

    default:
      // For unknown or custom widgets, return cached data or empty
      data = dataCache || { content: '', format: 'plain' as const };
      summary = {
        narrative: `Widget "${widget.title}" of type "${widget.type}"`,
      };
  }

  return {
    widget_id: widget.id,
    type: widget.type,
    title: widget.title,
    updated_at: widget.updated_at || new Date().toISOString(),
    data,
    summary,
  };
}

function getClockData(config: Record<string, unknown>): { data: ClockData; summary: WidgetDataSummary } {
  const now = new Date();
  const use24Hour = config.use24Hour as boolean;
  
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: config.showSeconds ? '2-digit' : undefined,
    hour12: !use24Hour,
  };

  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  const time = now.toLocaleTimeString('en-US', timeOptions);
  const date = now.toLocaleDateString('en-US', dateOptions);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    data: {
      time,
      date,
      timezone,
      timestamp: now.toISOString(),
    },
    summary: {
      narrative: `Current time is ${time} on ${date}`,
    },
  };
}

async function getWeatherWidgetData(
  config: Record<string, unknown>,
  dataCache: WeatherData | null
): Promise<{ data: WeatherData; summary: WidgetDataSummary }> {
  // Use cached data if available, otherwise return placeholder
  if (dataCache) {
    const summary: WidgetDataSummary = {
      narrative: `${dataCache.location}: ${dataCache.current.temp}°, ${dataCache.current.condition}`,
      key_points: [
        `Temperature: ${dataCache.current.temp}° (feels like ${dataCache.current.feels_like}°)`,
        `Condition: ${dataCache.current.condition}`,
        `Humidity: ${dataCache.current.humidity}%`,
        `Wind: ${dataCache.current.wind_speed} mph`,
      ],
    };

    return { data: dataCache, summary };
  }

  // Return placeholder if no cached data
  const location = (config.location as string) || 'Unknown';
  const placeholder: WeatherData = {
    location,
    current: {
      temp: 0,
      feels_like: 0,
      condition: 'Loading...',
      icon: '🌡️',
      humidity: 0,
      wind_speed: 0,
    },
  };

  return {
    data: placeholder,
    summary: {
      narrative: `Weather data for ${location} not yet loaded`,
    },
  };
}

function getNotesWidgetData(widgetId: string): { data: NotesData; summary: WidgetDataSummary } {
  const note = getNote(widgetId);
  const content = note?.content || '';
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const data: NotesData = {
    content,
    word_count: wordCount,
    char_count: content.length,
    updated_at: note?.updated_at || new Date().toISOString(),
  };

  const preview = content.slice(0, 100);
  const summary: WidgetDataSummary = {
    narrative: content
      ? `Notes: ${preview}${content.length > 100 ? '...' : ''} (${wordCount} words)`
      : 'Empty notes',
  };

  return { data, summary };
}

function getBookmarksWidgetData(widgetId: string): { data: BookmarksData; summary: WidgetDataSummary } {
  const bookmarks = getBookmarks(widgetId);

  const data: BookmarksData = {
    bookmarks: bookmarks.map((b) => ({
      id: b.id,
      title: b.title,
      url: b.url,
      icon: b.icon || undefined,
    })),
    total_count: bookmarks.length,
  };

  const summary: WidgetDataSummary = {
    narrative: bookmarks.length
      ? `${bookmarks.length} bookmarks: ${bookmarks.map((b) => b.title).join(', ')}`
      : 'No bookmarks saved',
    key_points: bookmarks.map((b) => `${b.title}: ${b.url}`),
  };

  return { data, summary };
}

function getStatCardData(
  config: Record<string, unknown>,
  dataCache: StatData | null
): { data: StatData; summary: WidgetDataSummary } {
  // Use cached/pushed data if available
  if (dataCache) {
    const trendText = dataCache.trend === 'up' 
      ? '↑' 
      : dataCache.trend === 'down' 
        ? '↓' 
        : '→';
    
    const changeText = dataCache.change_pct 
      ? ` (${dataCache.change_pct > 0 ? '+' : ''}${dataCache.change_pct.toFixed(1)}%)`
      : '';

    return {
      data: dataCache,
      summary: {
        narrative: `${dataCache.label}: ${dataCache.value} ${trendText}${changeText}`,
        trend: dataCache.trend,
        change_pct: dataCache.change_pct,
      },
    };
  }

  // Return from config for static stat cards
  const data: StatData = {
    value: (config.value as string | number) || 0,
    label: (config.label as string) || 'Stat',
    previous_value: config.previous_value as number,
    change: config.change as number,
    change_pct: config.change_pct as number,
    trend: config.trend as 'up' | 'down' | 'stable',
    sparkline: config.sparkline as number[],
  };

  return {
    data,
    summary: {
      narrative: `${data.label}: ${data.value}`,
      trend: data.trend,
      change_pct: data.change_pct,
    },
  };
}

function getMarkdownData(config: Record<string, unknown>): { data: TextData; summary: WidgetDataSummary } {
  const content = (config.content as string) || '';

  const data: TextData = {
    content,
    format: 'markdown',
  };

  // Extract first line or heading for summary
  const firstLine = content.split('\n')[0].replace(/^#+\s*/, '').slice(0, 100);

  return {
    data,
    summary: {
      narrative: firstLine || 'Empty markdown content',
    },
  };
}

async function getAnthropicUsageData(
  dataCache: AnthropicUsageData | null
): Promise<{ data: AnthropicUsageData; summary: WidgetDataSummary }> {
  // Use cached data if available
  if (dataCache && !dataCache.error) {
    const resetDate = dataCache.billingPeriod.resetDate
      ? new Date(dataCache.billingPeriod.resetDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : 'unknown';

    const keyPoints = [
      `Total spend: $${dataCache.totalCost.toFixed(2)}`,
    ];

    if (dataCache.budgetLimit) {
      keyPoints.push(`Budget: $${dataCache.budgetLimit.toFixed(2)} (${dataCache.usagePercent}% used)`);
    }

    keyPoints.push(`Resets: ${resetDate}`);

    if (dataCache.modelBreakdown.length > 0) {
      keyPoints.push(
        `Top model: ${dataCache.modelBreakdown[0].model} ($${dataCache.modelBreakdown[0].cost.toFixed(2)})`
      );
    }

    return {
      data: dataCache,
      summary: {
        narrative: `Anthropic API usage: $${dataCache.totalCost.toFixed(2)}${
          dataCache.usagePercent ? ` (${dataCache.usagePercent}% of budget)` : ''
        }, resets ${resetDate}`,
        key_points: keyPoints,
      },
    };
  }

  // Return placeholder if no cached data
  const placeholder: AnthropicUsageData = {
    totalCost: 0,
    budgetLimit: null,
    usagePercent: null,
    billingPeriod: {
      start: '',
      end: '',
      resetDate: '',
    },
    modelBreakdown: [],
    lastUpdated: new Date().toISOString(),
    error: dataCache?.error || 'Usage data not yet loaded',
  };

  return {
    data: placeholder,
    summary: {
      narrative: dataCache?.error || 'Anthropic usage data not available',
    },
  };
}

/**
 * Generate a dashboard snapshot for context injection
 */
export async function getDashboardSnapshot(
  widgets: WidgetRow[],
  format: 'json' | 'markdown' = 'json'
): Promise<string | object> {
  const widgetData = await Promise.all(widgets.map((w) => getWidgetData(w)));
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (format === 'markdown') {
    let md = `## Dashboard Snapshot (${timestamp})\n\n`;
    for (const wd of widgetData) {
      md += `- **${wd.title}:** ${wd.summary.narrative}\n`;
      if (wd.summary.key_points && wd.summary.key_points.length > 0) {
        for (const point of wd.summary.key_points.slice(0, 3)) {
          md += `  - ${point}\n`;
        }
      }
    }
    return md;
  }

  return {
    timestamp: new Date().toISOString(),
    widgets: widgetData.map((wd) => ({
      id: wd.widget_id,
      type: wd.type,
      title: wd.title,
      summary: wd.summary.narrative,
      key_points: wd.summary.key_points,
    })),
  };
}
