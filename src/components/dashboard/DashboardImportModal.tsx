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
  FileJson,
  Package,
  AlertTriangle,
  Key,
  Palette,
  LayoutGrid,
} from 'lucide-react';

interface DashboardImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface WidgetPreview {
  slug: string;
  name: string;
  has_conflict: boolean;
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
  widgets: WidgetPreview[];
  conflicts: WidgetConflict[];
  layout: {
    desktop_items: number;
    tablet_items: number;
    mobile_items: number;
  };
  has_theme: boolean;
  credentials_needed: string[];
  credentials_missing: string[];
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

            {/* Missing Credentials */}
            {preview.credentials_missing.length > 0 && (
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
