'use client';

import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileJson,
  Package,
  AlertTriangle,
  Key,
  Palette,
  LayoutGrid,
  Code,
  Server,
  ExternalLink,
  Copy,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface DashboardImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface WidgetPreviewDetail {
  slug: string;
  name: string;
  description?: string;
  has_conflict: boolean;
  source_code: string;
  server_code?: string;
  server_code_enabled: boolean;
  source_code_lines: number;
  server_code_lines?: number;
  credentials: Array<{ id: string; name: string; type: string }>;
}

interface CredentialPreviewDetail {
  id: string;
  type: 'api_key' | 'local_software' | 'oauth' | 'agent';
  name: string;
  description: string;
  obtain_url?: string;
  install_url?: string;
  is_configured: boolean;
}

interface ThemePreviewDetail {
  name: string;
  lightCss?: string;
  darkCss?: string;
  lightCss_lines: number;
  darkCss_lines: number;
}

interface WidgetConflict {
  slug: string;
  existing_name: string;
  incoming_name: string;
  action: 'will_overwrite' | 'will_rename' | 'will_skip';
}

interface ImportPreviewResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  dashboard: {
    name: string;
    description?: string;
    author?: string;
    exported_at: string;
    glance_version: string;
  };
  widget_count: number;
  widgets: WidgetPreviewDetail[];
  conflicts: WidgetConflict[];
  layout: {
    desktop_items: number;
    tablet_items: number;
    mobile_items: number;
  };
  has_theme: boolean;
  theme_details?: ThemePreviewDetail;
  credentials_needed: string[];
  credentials_missing: string[];
  credentials_details: CredentialPreviewDetail[];
}

interface ImportResponse {
  success: boolean;
  imported: {
    widgets: string[];
    widgets_skipped: string[];
    widgets_renamed: Array<{ original: string; renamed: string }>;
    theme: boolean;
    layout: boolean;
    layout_items: number;
  };
  credentials_missing: string[];
  errors: string[];
  warnings: string[];
}

type Step = 'upload' | 'preview' | 'complete';
type ConflictResolution = 'overwrite' | 'rename' | 'skip';

export function DashboardImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: DashboardImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<unknown>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('overwrite');
  const [importLayout, setImportLayout] = useState(true);
  const [importTheme, setImportTheme] = useState(true);
  const [clearExistingLayout, setClearExistingLayout] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedWidgets, setExpandedWidgets] = useState<Set<string>>(new Set());
  const [expandedWidgetCode, setExpandedWidgetCode] = useState<Record<string, 'source' | 'server' | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleWidget = (slug: string) => {
    setExpandedWidgets((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  };

  const toggleWidgetCode = (slug: string, codeType: 'source' | 'server') => {
    setExpandedWidgetCode((prev) => ({
      ...prev,
      [slug]: prev[slug] === codeType ? null : codeType,
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getCredentialTypeBadge = (type: string) => {
    switch (type) {
      case 'api_key':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-600">API Key</span>;
      case 'local_software':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-600">Local Software</span>;
      case 'oauth':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-600">OAuth</span>;
      case 'agent':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-600">Agent</span>;
      default:
        return null;
    }
  };

  const handleClose = () => {
    setStep('upload');
    setError(null);
    setFileName(null);
    setDashboardData(null);
    setPreview(null);
    setImportResult(null);
    setConflictResolution('overwrite');
    setImportLayout(true);
    setImportTheme(true);
    setClearExistingLayout(false);
    setExpandedSections(new Set());
    setExpandedWidgets(new Set());
    setExpandedWidgetCode({});
    onOpenChange(false);
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.glance.json') && !file.name.endsWith('.json')) {
      setError('Please select a .glance.json file');
      return;
    }

    setLoading(true);
    setError(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setDashboardData(data);

      // Get preview from API
      const response = await fetch('/api/dashboard/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });

      const previewData: ImportPreviewResponse = await response.json();

      if (!previewData.valid) {
        setError(previewData.errors.join(', '));
        return;
      }

      setPreview(previewData);
      setStep('preview');
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON file');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to read file');
      }
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, []);

  const handleImport = async () => {
    if (!dashboardData) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard: dashboardData,
          options: {
            import_widgets: true,
            import_theme: importTheme,
            import_layout: importLayout,
            conflict_resolution: conflictResolution,
            clear_existing_layout: clearExistingLayout,
          },
        }),
      });

      const data: ImportResponse = await response.json();

      if (!data.success) {
        setError(data.errors.join(', '));
        return;
      }

      setImportResult(data);
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    onImportComplete();
    handleClose();
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Dashboard
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Select a .glance.json file to import a complete dashboard.'}
            {step === 'preview' && 'Review what will be imported and configure options.'}
            {step === 'complete' && 'Dashboard imported successfully!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress */}
        {step !== 'upload' && step !== 'complete' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2 border-b">
            <span className="text-primary font-medium">Upload</span>
            <ChevronRight className="w-4 h-4" />
            <span className={step === 'preview' ? 'text-primary font-medium' : ''}>
              Preview
            </span>
            <ChevronRight className="w-4 h-4" />
            <span>Import</span>
          </div>
        )}

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4 py-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.glance.json"
              onChange={handleFileSelect}
              className="hidden"
            />

            <div
              onClick={triggerFileSelect}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Reading file...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <FileJson className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Click to select a .glance.json file</p>
                  <p className="text-xs text-muted-foreground">
                    or drag and drop here
                  </p>
                </div>
              )}
            </div>

            {fileName && (
              <p className="text-sm text-muted-foreground text-center">
                Selected: {fileName}
              </p>
            )}

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2 justify-center">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">What&apos;s in a .glance.json file?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Widget definitions and source code</li>
                <li>Dashboard layout configuration</li>
                <li>Custom theme settings</li>
                <li>Required credentials list</li>
              </ul>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && preview && (
          <div className="space-y-6 py-4">
            {/* Dashboard Info */}
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-lg">{preview.dashboard.name}</h3>
              {preview.dashboard.description && (
                <p className="text-sm text-muted-foreground">
                  {preview.dashboard.description}
                </p>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                {preview.dashboard.author && <span>By: {preview.dashboard.author}</span>}
                <span>Glance v{preview.dashboard.glance_version}</span>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  Widgets
                </div>
                <div className="text-lg font-semibold">{preview.widget_count}</div>
                {preview.conflicts.length > 0 && (
                  <div className="text-xs text-yellow-600">
                    {preview.conflicts.length} conflict(s)
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <LayoutGrid className="w-4 h-4" />
                  Layout
                </div>
                <div className="text-lg font-semibold">
                  {preview.layout.desktop_items} items
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Palette className="w-4 h-4" />
                  Theme
                </div>
                <div className="text-lg font-semibold">
                  {preview.has_theme ? 'Included' : 'None'}
                </div>
              </div>
            </div>

            {/* Widget Details Section */}
            {preview.widgets.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('widgets')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Code className="h-4 w-4" />
                    Widget Details
                    <span className="text-xs text-muted-foreground">({preview.widgets.length})</span>
                  </div>
                  {expandedSections.has('widgets') ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.has('widgets') && (
                  <div className="divide-y">
                    {preview.widgets.map((widget) => (
                      <div key={widget.slug} className="px-4 py-3">
                        <button
                          onClick={() => toggleWidget(widget.slug)}
                          className="w-full flex items-center justify-between text-left"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{widget.name}</span>
                              {widget.has_conflict && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/20 text-yellow-600">
                                  Conflict
                                </span>
                              )}
                              {widget.server_code_enabled && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-600">
                                  Server Code
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <code className="bg-muted px-1.5 rounded">{widget.slug}</code>
                              <span>{widget.source_code_lines} lines</span>
                              {widget.server_code_lines && (
                                <span>+{widget.server_code_lines} server</span>
                              )}
                            </div>
                          </div>
                          {expandedWidgets.has(widget.slug) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>

                        {expandedWidgets.has(widget.slug) && (
                          <div className="mt-3 space-y-3">
                            {widget.description && (
                              <p className="text-sm text-muted-foreground">{widget.description}</p>
                            )}

                            {/* Credentials for this widget */}
                            {widget.credentials.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {widget.credentials.map((cred) => (
                                  <span
                                    key={cred.id}
                                    className="px-2 py-0.5 rounded text-xs bg-blue-500/10 text-blue-600 flex items-center gap-1"
                                  >
                                    <Key className="h-3 w-3" />
                                    {cred.name}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Code view buttons */}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleWidgetCode(widget.slug, 'source')}
                                className="text-xs h-7"
                              >
                                <Code className="h-3 w-3 mr-1" />
                                {expandedWidgetCode[widget.slug] === 'source' ? 'Hide' : 'View'} Source
                              </Button>
                              {widget.server_code && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleWidgetCode(widget.slug, 'server')}
                                  className="text-xs h-7"
                                >
                                  <Server className="h-3 w-3 mr-1" />
                                  {expandedWidgetCode[widget.slug] === 'server' ? 'Hide' : 'View'} Server
                                </Button>
                              )}
                            </div>

                            {/* Source code preview */}
                            {expandedWidgetCode[widget.slug] === 'source' && (
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(widget.source_code)}
                                  className="absolute top-2 right-2 h-7 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                                <pre className="bg-muted p-3 rounded-lg text-xs max-h-64 overflow-auto font-mono">
                                  <code>{widget.source_code}</code>
                                </pre>
                              </div>
                            )}

                            {/* Server code preview */}
                            {expandedWidgetCode[widget.slug] === 'server' && widget.server_code && (
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(widget.server_code!)}
                                  className="absolute top-2 right-2 h-7 text-xs"
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy
                                </Button>
                                <pre className="bg-muted p-3 rounded-lg text-xs max-h-64 overflow-auto font-mono">
                                  <code>{widget.server_code}</code>
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Credentials Section */}
            {preview.credentials_details.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('credentials')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Key className="h-4 w-4" />
                    Credentials
                    <span className="text-xs text-muted-foreground">({preview.credentials_details.length})</span>
                    {preview.credentials_missing.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-600">
                        {preview.credentials_missing.length} missing
                      </span>
                    )}
                  </div>
                  {expandedSections.has('credentials') ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.has('credentials') && (
                  <div className="p-4 space-y-3">
                    {preview.credentials_details.map((cred) => (
                      <div
                        key={cred.id}
                        className={`rounded-lg p-3 ${
                          cred.is_configured ? 'bg-green-500/5 border border-green-500/20' : 'bg-amber-500/5 border border-amber-500/20'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{cred.name}</span>
                              {getCredentialTypeBadge(cred.type)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{cred.description}</p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                              cred.is_configured
                                ? 'bg-green-500/20 text-green-600'
                                : 'bg-amber-500/20 text-amber-600'
                            }`}
                          >
                            {cred.is_configured ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Configured
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                Missing
                              </>
                            )}
                          </span>
                        </div>
                        {cred.obtain_url && !cred.is_configured && (
                          <a
                            href={cred.obtain_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Get API Key
                          </a>
                        )}
                        {cred.install_url && !cred.is_configured && (
                          <a
                            href={cred.install_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 ml-3 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Install Guide
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Theme Preview Section */}
            {preview.theme_details && (
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('theme')}
                  className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Palette className="h-4 w-4" />
                    Theme: {preview.theme_details.name}
                  </div>
                  {expandedSections.has('theme') ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.has('theme') && (
                  <div className="p-4 space-y-4">
                    {preview.theme_details.lightCss && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Light Theme</span>
                          <span className="text-xs text-muted-foreground">
                            {preview.theme_details.lightCss_lines} lines
                          </span>
                        </div>
                        <pre className="bg-muted p-3 rounded-lg text-xs max-h-40 overflow-auto font-mono">
                          <code>
                            {preview.theme_details.lightCss.split('\n').slice(0, 10).join('\n')}
                            {preview.theme_details.lightCss_lines > 10 && '\n...'}
                          </code>
                        </pre>
                      </div>
                    )}
                    {preview.theme_details.darkCss && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Dark Theme</span>
                          <span className="text-xs text-muted-foreground">
                            {preview.theme_details.darkCss_lines} lines
                          </span>
                        </div>
                        <pre className="bg-muted p-3 rounded-lg text-xs max-h-40 overflow-auto font-mono">
                          <code>
                            {preview.theme_details.darkCss.split('\n').slice(0, 10).join('\n')}
                            {preview.theme_details.darkCss_lines > 10 && '\n...'}
                          </code>
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warnings
                </div>
                <ul className="text-sm text-yellow-600/80 space-y-1">
                  {preview.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing Credentials Warning (only if no detailed credentials info) */}
            {preview.credentials_missing.length > 0 && preview.credentials_details.length === 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-2">
                  <Key className="w-4 h-4" />
                  Credentials Needed
                </div>
                <p className="text-sm text-blue-600/80 mb-2">
                  These API keys need to be configured for full functionality:
                </p>
                <div className="flex flex-wrap gap-2">
                  {preview.credentials_missing.map((cred) => (
                    <span
                      key={cred}
                      className="px-2 py-1 bg-blue-500/20 rounded text-xs text-blue-700"
                    >
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Conflict Resolution */}
            {preview.conflicts.length > 0 && (
              <div className="space-y-3">
                <Label>Conflict Resolution</Label>
                <p className="text-sm text-muted-foreground">
                  {preview.conflicts.length} widget(s) already exist. How should we handle them?
                </p>
                <Select
                  value={conflictResolution}
                  onValueChange={(value: ConflictResolution) => setConflictResolution(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overwrite">
                      Overwrite existing widgets
                    </SelectItem>
                    <SelectItem value="rename">
                      Keep both (rename imported)
                    </SelectItem>
                    <SelectItem value="skip">
                      Skip conflicting widgets
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Show conflicts */}
                <div className="border rounded-lg p-3 space-y-2 max-h-32 overflow-y-auto">
                  {preview.conflicts.map((conflict) => (
                    <div
                      key={conflict.slug}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-mono text-xs">{conflict.slug}</span>
                      <span className="text-muted-foreground">
                        &quot;{conflict.existing_name}&quot; → &quot;{conflict.incoming_name}&quot;
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Import Options */}
            <div className="space-y-3">
              <Label>Import Options</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importLayout}
                    onChange={(e) => setImportLayout(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Import layout positions</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importTheme}
                    onChange={(e) => setImportTheme(e.target.checked)}
                    className="rounded border-gray-300"
                    disabled={!preview.has_theme}
                  />
                  <span className={`text-sm ${!preview.has_theme ? 'text-muted-foreground' : ''}`}>
                    Import theme {!preview.has_theme && '(none included)'}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearExistingLayout}
                    onChange={(e) => setClearExistingLayout(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-yellow-600">
                    Clear existing dashboard first
                  </span>
                </label>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Import Dashboard
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <div className="space-y-6 py-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium">Import Complete!</h3>
            </div>

            {/* Results Summary */}
            <div className="border rounded-lg p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Widgets imported:</span>
                <span className="font-medium">{importResult.imported.widgets.length}</span>
              </div>
              {importResult.imported.widgets_skipped.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Widgets skipped:</span>
                  <span className="font-medium text-yellow-600">
                    {importResult.imported.widgets_skipped.length}
                  </span>
                </div>
              )}
              {importResult.imported.widgets_renamed.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Widgets renamed:</span>
                  <span className="font-medium text-blue-600">
                    {importResult.imported.widgets_renamed.length}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span>Layout items:</span>
                <span className="font-medium">{importResult.imported.layout_items}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Theme imported:</span>
                <span className="font-medium">{importResult.imported.theme ? 'Yes' : 'No'}</span>
              </div>
            </div>

            {/* Renamed widgets */}
            {importResult.imported.widgets_renamed.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="text-sm font-medium mb-2">Renamed Widgets</h4>
                <div className="space-y-1 text-sm">
                  {importResult.imported.widgets_renamed.map(({ original, renamed }) => (
                    <div key={original} className="font-mono text-xs">
                      {original} → {renamed}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing credentials reminder */}
            {importResult.credentials_missing.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-yellow-600 mb-2">
                  <Key className="w-4 h-4" />
                  Configure API Keys
                </div>
                <p className="text-sm text-yellow-600/80">
                  Remember to configure these credentials for full functionality:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {importResult.credentials_missing.map((cred) => (
                    <span
                      key={cred}
                      className="px-2 py-1 bg-yellow-500/20 rounded text-xs text-yellow-700"
                    >
                      {cred}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {importResult.warnings.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <h4 className="font-medium mb-1">Notes:</h4>
                <ul className="space-y-1">
                  {importResult.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
