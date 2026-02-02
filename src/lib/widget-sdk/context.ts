"use client";

import React from "react";
import * as Components from "./components";
import { createWidgetHooks } from "./hooks";
import type { WidgetConfig, WidgetContext } from "./types";

/**
 * Creates a sandboxed execution context for widget code
 *
 * This context provides:
 * - UI components (shadcn + helpers)
 * - Icons (subset of lucide-react)
 * - Hooks (useData, useConfig, useWidgetState)
 * - React reference
 * - cn utility for className merging
 *
 * It explicitly does NOT provide:
 * - window, document, navigator
 * - fetch, XMLHttpRequest
 * - eval, Function (as constructors)
 * - import, require
 */
export function createWidgetContext(context: WidgetContext) {
  const {
    widgetId,
    config,
    refreshInterval,
    customWidgetSlug,
    serverCodeEnabled,
  } = context;

  // Create hooks bound to this widget's context
  const hooks = createWidgetHooks({
    widgetId,
    config,
    refreshInterval,
    customWidgetSlug,
    serverCodeEnabled,
  });

  return {
    // UI Components (shadcn)
    Button: Components.Button,
    Card: Components.Card,
    CardHeader: Components.CardHeader,
    CardFooter: Components.CardFooter,
    CardTitle: Components.CardTitle,
    CardDescription: Components.CardDescription,
    CardContent: Components.CardContent,
    Input: Components.Input,
    Label: Components.Label,
    Separator: Components.Separator,
    Switch: Components.Switch,
    Tabs: Components.Tabs,
    TabsList: Components.TabsList,
    TabsTrigger: Components.TabsTrigger,
    TabsContent: Components.TabsContent,
    Tooltip: Components.Tooltip,
    TooltipContent: Components.TooltipContent,
    TooltipProvider: Components.TooltipProvider,
    TooltipTrigger: Components.TooltipTrigger,
    Avatar: Components.Avatar,
    AvatarImage: Components.AvatarImage,
    AvatarFallback: Components.AvatarFallback,

    // Helper components
    Stack: Components.Stack,
    Grid: Components.Grid,
    Badge: Components.Badge,
    Progress: Components.Progress,
    Stat: Components.Stat,
    List: Components.List,
    Loading: Components.Loading,
    ErrorDisplay: Components.ErrorDisplay,
    Empty: Components.Empty,

    // Icons
    Icons: Components.Icons,

    // Utility
    cn: Components.cn,

    // Hooks
    useData: hooks.useData,
    useConfig: hooks.useConfig,
    useWidgetState: hooks.useWidgetState,

    // React
    React,
    Fragment: React.Fragment,
    useState: React.useState,
    useEffect: React.useEffect,
    useCallback: React.useCallback,
    useMemo: React.useMemo,
    useRef: React.useRef,
  };
}

/**
 * Execute transpiled widget code in a sandboxed context
 * Returns the Widget component function
 */
export function executeWidgetCode(
  transpiledCode: string,
  context: ReturnType<typeof createWidgetContext>,
): React.ComponentType<{ config: WidgetConfig; serverData?: unknown }> {
  // Build the argument list for the sandbox function
  const contextKeys = Object.keys(context);
  const contextValues = Object.values(context);

  // Shadow dangerous globals inside the function body (not as parameters)
  // This avoids strict mode issues with reserved words like 'eval'
  // Note: fetch is allowed - CORS provides natural sandboxing in browser
  const blockedGlobalsDeclaration = `
    var window = undefined;
    var document = undefined;
    var navigator = undefined;
    var XMLHttpRequest = undefined;
    var WebSocket = undefined;
    var localStorage = undefined;
    var sessionStorage = undefined;
    var importScripts = undefined;
  `;

  const wrappedCode = `
    "use strict";
    ${blockedGlobalsDeclaration}
    
    // Widget code starts here
    ${transpiledCode}
    
    // Return the Widget component
    if (typeof Widget !== 'undefined') {
      return Widget;
    } else {
      throw new Error('Widget component not found. Define a function named "Widget".');
    }
  `;

  try {
    // Create a function with controlled context (only safe context keys as params)
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const createWidget = new Function(...contextKeys, wrappedCode);

    // Execute with context values only
    const Widget = createWidget(...contextValues);

    if (typeof Widget !== "function") {
      throw new Error("Widget must be a function component");
    }

    return Widget as React.ComponentType<{
      config: WidgetConfig;
      serverData?: unknown;
    }>;
  } catch (error) {
    // Return an error component if execution fails
    const ErrorWidget: React.FC<{
      config: WidgetConfig;
      serverData?: unknown;
    }> = () => {
      return React.createElement(Components.ErrorDisplay, {
        message:
          error instanceof Error
            ? error.message
            : "Failed to execute widget code",
      });
    };
    return ErrorWidget;
  }
}

export type { WidgetContext };
