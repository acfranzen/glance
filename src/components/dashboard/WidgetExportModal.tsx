'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Key,
  Loader2,
  Package,
  Settings,
} from 'lucide-react';

interface WidgetExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetSlug: string;
  widgetName: string;
}

interface ExportResponse {
  package: string;
  meta: {
    name: string;
    slug: string;
    description?: string;
    author?: string;
    created_at: string;
    exported_at: string;
  };
  credentials_count: number;
  has_setup: boolean;
  fetch_type: string;
  validation: {
    valid: boolean;
    warnings: string[];
  };
}

export function WidgetExportModal({
  open,
  onOpenChange,
  widgetSlug,
  widgetName,
}: WidgetExportModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportData, setExportData] = useState<ExportResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [author, setAuthor] = useState('');

  useEffect(() => {
    if (open && widgetSlug) {
      fetchExport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, widgetSlug]);

  async function fetchExport() {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/widget-packages/${widgetSlug}`, window.location.origin);
      if (author) {
        url.searchParams.set('author', author);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to export widget');
      }

      const data = await response.json();
      setExportData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export widget');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyPackage() {
    if (!exportData?.package) return;
    await navigator.clipboard.writeText(exportData.package);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    if (!exportData?.package) return;
    const blob = new Blob([exportData.package], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${widgetSlug}.glance`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const handleAuthorChange = (newAuthor: string) => {
    setAuthor(newAuthor);
    // Re-fetch with new author after a short delay
    const timeout = setTimeout(() => {
      fetchExport();
    }, 500);
    return () => clearTimeout(timeout);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Export Widget Package
          </DialogTitle>
          <DialogDescription>
            Export &quot;{widgetName}&quot; as a shareable package string.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-red-500">{error}</p>
          </div>
        ) : exportData ? (
          <div className="space-y-6">
            {/* Package Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Key className="w-4 h-4" />
                  Credentials
                </div>
                <div className="text-lg font-semibold">
                  {exportData.credentials_count}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Settings className="w-4 h-4" />
                  Local Setup
                </div>
                <div className="text-lg font-semibold">
                  {exportData.has_setup ? 'Required' : 'None'}
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Package className="w-4 h-4" />
                  Fetch Type
                </div>
                <div className="text-lg font-semibold capitalize">
                  {exportData.fetch_type.replace('_', ' ')}
                </div>
              </div>
            </div>

            {/* Warnings */}
            {exportData.validation.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <h4 className="text-sm font-medium text-yellow-600 mb-2">
                  Warnings
                </h4>
                <ul className="text-sm text-yellow-600/80 space-y-1">
                  {exportData.validation.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Author */}
            <div className="space-y-2">
              <Label htmlFor="author">Author (optional)</Label>
              <Input
                id="author"
                placeholder="Your name or username"
                value={author}
                onChange={(e) => handleAuthorChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include your name in the package so others know who created it.
              </p>
            </div>

            {/* Package String */}
            <div className="space-y-2">
              <Label>Package String</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 border-b flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {exportData.package.length.toLocaleString()} characters
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPackage}
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDownload}>
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-muted/20 max-h-40 overflow-y-auto">
                  <code className="text-xs font-mono break-all">
                    {exportData.package}
                  </code>
                </div>
              </div>
            </div>

            {/* Usage Instructions */}
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">How to share</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Copy the package string above</li>
                <li>Share it via chat, file, or paste into your AI assistant</li>
                <li>Recipients can import it using the Import button on their dashboard</li>
              </ol>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
