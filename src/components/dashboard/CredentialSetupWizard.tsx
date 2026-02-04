'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Terminal,
  Copy,
} from 'lucide-react';

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

interface CredentialSetupWizardProps {
  credentials: CredentialStatus[];
  onCredentialConfigured: (id: string) => void;
  onComplete: () => void;
}

export function CredentialSetupWizard({
  credentials,
  onCredentialConfigured,
  onComplete,
}: CredentialSetupWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingInstall, setCheckingInstall] = useState(false);

  const missingCredentials = credentials.filter(
    (c) => c.status === 'missing' || c.status === 'not_installed',
  );

  const currentCredential = missingCredentials[currentIndex];

  if (!currentCredential) {
    // All credentials configured
    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-12 h-12 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
          <Check className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="text-lg font-medium">All Credentials Configured</h3>
        <p className="text-sm text-muted-foreground">
          Your widget has all the credentials it needs to work.
        </p>
        <Button onClick={onComplete}>Continue</Button>
      </div>
    );
  }

  const handleSaveApiKey = async () => {
    if (!apiKeyValue.trim()) {
      setError('Please enter an API key');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: currentCredential.id,
          name: currentCredential.name,
          value: apiKeyValue,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save credential');
      }

      // Success - move to next
      onCredentialConfigured(currentCredential.id);
      setApiKeyValue('');
      setShowValue(false);

      if (currentIndex < missingCredentials.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckInstallation = async () => {
    setCheckingInstall(true);
    setError(null);

    try {
      // For now, we'll just mark it as configured if the user says they installed it
      // The actual check happens during import validation
      onCredentialConfigured(currentCredential.id);

      if (currentIndex < missingCredentials.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        onComplete();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check installation',
      );
    } finally {
      setCheckingInstall(false);
    }
  };

  const handleSkip = () => {
    if (currentIndex < missingCredentials.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
  };

  const progress = ((currentIndex + 1) / missingCredentials.length) * 100;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Credential {currentIndex + 1} of {missingCredentials.length}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Credential */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {currentCredential.type === 'api_key' || currentCredential.type === 'oauth' ? (
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-500" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-purple-500" />
            </div>
          )}
          <div>
            <h3 className="font-medium">{currentCredential.name}</h3>
            <p className="text-sm text-muted-foreground">
              {currentCredential.description}
            </p>
          </div>
        </div>

        {/* API Key Form */}
        {(currentCredential.type === 'api_key' || currentCredential.type === 'oauth') && (
          <div className="space-y-4 border rounded-lg p-4">
            {currentCredential.obtain_url && (
              <a
                href={currentCredential.obtain_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Get your API key here
              </a>
            )}

            {currentCredential.obtain_instructions && (
              <p className="text-sm text-muted-foreground">
                {currentCredential.obtain_instructions}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showValue ? 'text' : 'password'}
                  placeholder="Enter your API key..."
                  value={apiKeyValue}
                  onChange={(e) => setApiKeyValue(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowValue(!showValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showValue ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSaveApiKey} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Save & Continue
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {/* Local Software Instructions */}
        {currentCredential.type === 'local_software' && (
          <div className="space-y-4 border rounded-lg p-4">
            {currentCredential.install_url && (
              <a
                href={currentCredential.install_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                Installation instructions
              </a>
            )}

            {currentCredential.install_instructions && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {currentCredential.install_instructions}
              </div>
            )}

            {currentCredential.check_command && (
              <div className="bg-muted rounded p-3 font-mono text-sm flex items-center justify-between">
                <code>{currentCredential.check_command}</code>
                <button
                  onClick={() =>
                    handleCopyCommand(currentCredential.check_command!)
                  }
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={handleCheckInstallation} disabled={checkingInstall}>
                {checkingInstall ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    I&apos;ve Installed It
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleSkip}>
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
