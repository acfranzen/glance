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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Check, AlertCircle, Eye, EyeOff, Database, Cloud, Loader2 } from 'lucide-react';

interface Credential {
  id: string;
  provider: string;
  name: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  hasEnvFallback: boolean;
}

interface CredentialStatus {
  configured: boolean;
  source: 'database' | 'env' | null;
}

interface CredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CredentialsModal({ open, onOpenChange }: CredentialsModalProps) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [status, setStatus] = useState<Record<string, CredentialStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add credential form
  const [isAdding, setIsAdding] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchCredentials();
    }
  }, [open]);

  async function fetchCredentials() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) throw new Error('Failed to fetch credentials');
      const data = await response.json();
      setCredentials(data.credentials || []);
      setProviders(data.providers || []);
      setStatus(data.status || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCredential() {
    if (!newProvider || !newName || !newValue) {
      setValidationError('All fields are required');
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newProvider,
          name: newName,
          value: newValue,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add credential');
      }

      // Reset form and refresh
      setIsAdding(false);
      setNewProvider('');
      setNewName('');
      setNewValue('');
      setShowValue(false);
      await fetchCredentials();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Failed to add credential');
    } finally {
      setValidating(false);
    }
  }

  async function handleDeleteCredential(id: string) {
    if (!confirm('Are you sure you want to delete this credential?')) return;

    try {
      const response = await fetch(`/api/credentials/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete credential');
      await fetchCredentials();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete credential');
    }
  }

  function getProviderName(providerId: string): string {
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || providerId;
  }

  function getStatusIcon(providerId: string) {
    const providerStatus = status[providerId];
    if (!providerStatus?.configured) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
    if (providerStatus.source === 'database') {
      return <Database className="w-4 h-4 text-green-500" />;
    }
    if (providerStatus.source === 'env') {
      return <Cloud className="w-4 h-4 text-blue-500" />;
    }
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>API Credentials</DialogTitle>
          <DialogDescription>
            Manage API keys for your widgets. Keys are encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : (
          <div className="space-y-6">
            {/* Provider Status Overview */}
            <div>
              <h3 className="text-sm font-medium mb-3">Provider Status</h3>
              <div className="grid grid-cols-2 gap-2">
                {providers.map(provider => (
                  <div
                    key={provider.id}
                    className="flex items-center gap-2 p-2 rounded border bg-muted/30"
                  >
                    {getStatusIcon(provider.id)}
                    <span className="text-sm">{provider.name}</span>
                    {!status[provider.id]?.configured && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Not configured
                      </span>
                    )}
                    {status[provider.id]?.source === 'env' && (
                      <span className="text-xs text-blue-500 ml-auto">
                        From .env
                      </span>
                    )}
                    {status[provider.id]?.source === 'database' && (
                      <span className="text-xs text-green-500 ml-auto">
                        <Check className="w-3 h-3 inline" /> Stored
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Existing Credentials */}
            {credentials.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Stored Credentials</h3>
                <div className="space-y-2">
                  {credentials.map(cred => (
                    <div
                      key={cred.id}
                      className="flex items-center justify-between p-3 rounded border"
                    >
                      <div>
                        <div className="font-medium">{cred.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {getProviderName(cred.provider)} • Added {new Date(cred.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCredential(cred.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Credential Form */}
            {isAdding ? (
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium">Add New Credential</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={newProvider} onValueChange={setNewProvider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map(provider => (
                        <SelectItem key={provider.id} value={provider.id}>
                          <div className="flex flex-col">
                            <span>{provider.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {provider.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., My Anthropic Key"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">API Key</Label>
                  <div className="relative">
                    <Input
                      id="value"
                      type={showValue ? 'text' : 'password'}
                      placeholder="sk-..."
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowValue(!showValue)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {validationError && (
                  <div className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {validationError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleAddCredential}
                    disabled={validating}
                  >
                    {validating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Credential
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAdding(false);
                      setNewProvider('');
                      setNewName('');
                      setNewValue('');
                      setShowValue(false);
                      setValidationError(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setIsAdding(true)} variant="outline" className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Add Credential
              </Button>
            )}

            {/* Help text */}
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="flex items-center gap-2">
                <Database className="w-4 h-4 text-green-500" />
                <span>Stored in database (encrypted with your AUTH_TOKEN)</span>
              </p>
              <p className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-500" />
                <span>Loaded from environment variable</span>
              </p>
              <p className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span>Not configured — widget will show setup instructions</span>
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
