'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Settings,
  Loader2,
  FileText,
} from 'lucide-react';

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

interface SetupWizardProps {
  setup: SetupStatus;
  widgetSlug: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function SetupWizard({
  setup,
  widgetSlug,
  onComplete,
  onSkip,
}: SetupWizardProps) {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (setup.status === 'not_required' || setup.status === 'configured') {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-12 h-12 mx-auto bg-green-500/10 rounded-full flex items-center justify-center">
          <Check className="w-6 h-6 text-green-500" />
        </div>
        <h3 className="text-lg font-medium">
          {setup.status === 'configured'
            ? 'Setup Complete'
            : 'No Setup Required'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {setup.status === 'configured'
            ? 'Your widget is configured and ready to use.'
            : 'This widget works out of the box, no additional setup needed.'}
        </p>
        <Button onClick={onComplete}>Continue</Button>
      </div>
    );
  }

  const handleCopyInstructions = async () => {
    if (!setup.agent_skill) return;
    await navigator.clipboard.writeText(setup.agent_skill);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);

    try {
      // Mark the setup as complete
      const response = await fetch('/api/widgets/setups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widget_slug: widgetSlug,
          status: 'configured',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update setup status');
      }

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify setup');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <h3 className="font-medium">Local Setup Required</h3>
          {setup.estimated_time && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Estimated time: {setup.estimated_time}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      {setup.description && (
        <p className="text-sm text-muted-foreground">{setup.description}</p>
      )}

      {/* Agent Skill Instructions */}
      {setup.agent_skill && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4" />
              Setup Instructions (for AI Agent)
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInstructions}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Instructions
                </>
              )}
            </Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b text-sm text-muted-foreground">
              Give these instructions to your AI coding assistant (Claude, Cursor, etc.)
            </div>
            <div className="p-4 max-h-80 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {setup.agent_skill}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Verification Info */}
      {setup.verification && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium">Verification</h4>
          <p className="text-sm text-muted-foreground">
            {setup.verification.type === 'file_exists' &&
              `The setup will be verified when the file "${setup.verification.target}" exists.`}
            {setup.verification.type === 'command_succeeds' &&
              `The setup will be verified when this command succeeds: ${setup.verification.target}`}
            {setup.verification.type === 'endpoint_responds' &&
              `The setup will be verified when the endpoint "${setup.verification.target}" responds.`}
          </p>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={handleVerify} disabled={verifying}>
          {verifying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              I&apos;ve Completed Setup
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>

      {/* Help text */}
      <p className="text-xs text-muted-foreground">
        This widget requires local configuration. You can copy the setup
        instructions to your AI coding assistant, or follow them manually. The
        widget may not work correctly until setup is complete.
      </p>
    </div>
  );
}
