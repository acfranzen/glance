'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  Check,
  Key,
  Loader2,
  Package,
  Settings,
  Upload,
  ChevronRight,
} from 'lucide-react';
import { CredentialSetupWizard } from './CredentialSetupWizard';
import { SetupWizard } from './SetupWizard';

interface WidgetImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface CredentialStatus {
  id: string;
  type: 'api_key' | 'local_software' | 'oauth';
  name: string;
  status: 'configured' | 'missing' | 'installed' | 'not_installed';
  description: string;
  obtain_url?: string;
  obtain_instructions?: string;
  install_url?: string;
  install_instructions?: string;
  check_command?: string;
}

interface SetupStatus {
  status: 'configured' | 'not_configured' | 'not_required';
  description?: string;
  agent_skill?: string;
  verification?: {
    type: 'file_exists' | 'command_succeeds' | 'endpoint_responds';
    target: string;
  };
  estimated_time?: string;
}

interface ValidationResult {
  valid: boolean;
  widget_preview?: {
    name: string;
    slug: string;
    description?: string;
  };
  status?: {
    credentials: CredentialStatus[];
    setup: SetupStatus;
    fetch: {
      type: string;
      status: 'ready' | 'not_ready';
      cache_path?: string;
    };
  };
  ready_to_import: boolean;
  blocking_issues: string[];
  message: string;
  widget?: {
    id: string;
    name: string;
    slug: string;
  };
  instance_id?: string;
  validation?: {
    errors: string[];
    warnings: string[];
  };
}

type Step = 'input' | 'preview' | 'credentials' | 'setup' | 'complete';

export function WidgetImportModal({
  open,
  onOpenChange,
  onImportComplete,
}: WidgetImportModalProps) {
  const [packageString, setPackageString] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<ValidationResult | null>(null);
  const [addToDashboard, setAddToDashboard] = useState(true);

  const handleClose = () => {
    // Reset state on close
    setPackageString('');
    setStep('input');
    setError(null);
    setValidationResult(null);
    setImportResult(null);
    onOpenChange(false);
  };

  const handleValidate = async () => {
    if (!packageString.trim()) {
      setError('Please paste a widget package string');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/widgets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: packageString,
          dry_run: true,
        }),
      });

      const data = await response.json();

      if (!data.valid) {
        setError(data.message || 'Invalid package');
        return;
      }

      setValidationResult(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate package');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/widgets/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: packageString,
          dry_run: false,
          auto_add_to_dashboard: addToDashboard,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.message || 'Failed to import');
        return;
      }

      setImportResult(data);

      // Check if we need to go through credential or setup wizards
      const credentials = validationResult?.status?.credentials || [];
      const missingCredentials = credentials.filter(
        (c) => c.status === 'missing' || c.status === 'not_installed',
      );

      if (missingCredentials.length > 0) {
        setStep('credentials');
      } else if (
        validationResult?.status?.setup?.status === 'not_configured'
      ) {
        setStep('setup');
      } else {
        setStep('complete');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import widget');
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialConfigured = (id: string) => {
    // Update the validation result to mark credential as configured
    if (validationResult?.status?.credentials) {
      const updated = {
        ...validationResult,
        status: {
          ...validationResult.status,
          credentials: validationResult.status.credentials.map((c) =>
            c.id === id ? { ...c, status: 'configured' as const } : c,
          ),
        },
      };
      setValidationResult(updated);
    }
  };

  const handleCredentialsComplete = () => {
    if (validationResult?.status?.setup?.status === 'not_configured') {
      setStep('setup');
    } else {
      setStep('complete');
    }
  };

  const handleSetupComplete = () => {
    setStep('complete');
  };

  const handleDone = () => {
    onImportComplete();
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Widget Package
          </DialogTitle>
          <DialogDescription>
            {step === 'input' &&
              'Paste a widget package string to import a custom widget.'}
            {step === 'preview' && 'Review the widget before importing.'}
            {step === 'credentials' && 'Configure required credentials.'}
            {step === 'setup' && 'Complete local setup.'}
            {step === 'complete' && 'Widget imported successfully!'}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress */}
        {step !== 'input' && step !== 'complete' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <span
              className={
                step === 'preview' ? 'text-primary font-medium' : ''
              }
            >
              Preview
            </span>
            <ChevronRight className="w-4 h-4" />
            <span
              className={
                step === 'credentials' ? 'text-primary font-medium' : ''
              }
            >
              Credentials
            </span>
            <ChevronRight className="w-4 h-4" />
            <span
              className={step === 'setup' ? 'text-primary font-medium' : ''}
            >
              Setup
            </span>
          </div>
        )}

        {/* Input Step */}
        {step === 'input' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="package">Package String</Label>
              <textarea
                id="package"
                className="w-full h-32 px-3 py-2 text-sm rounded-md border bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Paste your !GW1!... package string here"
                value={packageString}
                onChange={(e) => setPackageString(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleValidate}
              disabled={loading || !packageString.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4 mr-2" />
                  Validate Package
                </>
              )}
            </Button>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && validationResult && (
          <div className="space-y-6">
            {/* Widget Preview */}
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="font-medium text-lg">
                {validationResult.widget_preview?.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {validationResult.widget_preview?.description ||
                  'No description'}
              </p>
              <div className="text-xs text-muted-foreground">
                Slug: {validationResult.widget_preview?.slug}
              </div>
            </div>

            {/* Requirements Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Key className="w-4 h-4" />
                  Credentials
                </div>
                <div className="text-lg font-semibold">
                  {validationResult.status?.credentials?.length || 0}
                </div>
                {validationResult.status?.credentials?.some(
                  (c) => c.status === 'missing' || c.status === 'not_installed',
                ) && (
                  <div className="text-xs text-yellow-600">
                    Some need configuration
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Settings className="w-4 h-4" />
                  Local Setup
                </div>
                <div className="text-lg font-semibold capitalize">
                  {validationResult.status?.setup?.status === 'not_required'
                    ? 'None'
                    : validationResult.status?.setup?.status === 'configured'
                      ? 'Done'
                      : 'Required'}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  Fetch Type
                </div>
                <div className="text-lg font-semibold capitalize">
                  {validationResult.status?.fetch?.type?.replace('_', ' ') ||
                    'Unknown'}
                </div>
              </div>
            </div>

            {/* Warnings */}
            {validationResult.validation?.warnings &&
              validationResult.validation.warnings.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-yellow-600 mb-2">
                    Warnings
                  </h4>
                  <ul className="text-sm text-yellow-600/80 space-y-1">
                    {validationResult.validation.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

            {/* Add to Dashboard Option */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addToDashboard}
                onChange={(e) => setAddToDashboard(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Add widget to dashboard after import</span>
            </label>

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Import Widget
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
            </div>
          </div>
        )}

        {/* Credentials Step */}
        {step === 'credentials' && validationResult?.status?.credentials && (
          <CredentialSetupWizard
            credentials={validationResult.status.credentials}
            onCredentialConfigured={handleCredentialConfigured}
            onComplete={handleCredentialsComplete}
          />
        )}

        {/* Setup Step */}
        {step === 'setup' && validationResult?.status?.setup && importResult?.widget && (
          <SetupWizard
            setup={validationResult.status.setup}
            widgetSlug={importResult.widget.slug}
            onComplete={handleSetupComplete}
            onSkip={handleSetupComplete}
          />
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult?.widget && (
          <div className="space-y-4 text-center py-6">
            <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-lg font-medium">Widget Imported!</h3>
            <p className="text-sm text-muted-foreground">
              &quot;{importResult.widget.name}&quot; has been imported
              successfully.
              {importResult.instance_id &&
                ' It has been added to your dashboard.'}
            </p>
            <Button onClick={handleDone}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
