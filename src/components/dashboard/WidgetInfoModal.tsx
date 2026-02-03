'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Clock, Database, Key, Settings, Code, CheckCircle, XCircle,
  FileText, User, Calendar, RefreshCw, ExternalLink, Copy,
  ChevronDown, ChevronUp, Zap, Server, Webhook, Bot
} from 'lucide-react';

interface WidgetInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widgetSlug: string;
  widgetName: string;
}

interface CredentialInfo {
  id: string;
  type: 'api_key' | 'local_software' | 'oauth' | 'agent';
  name: string;
  description?: string;
  obtain_url?: string;
  install_url?: string;
  check_command?: string;
  // Agent credential fields
  agent_tool?: string;
  agent_auth_check?: string;
  agent_auth_instructions?: string;
}

interface SetupInfo {
  status: string;
  description?: string;
  agent_skill?: string;
  verification?: {
    type: string;
    target: string;
  };
  estimated_time?: string;
}

interface FetchInfo {
  type: 'server_code' | 'webhook' | 'agent_refresh';
  refresh_command?: string;
  webhook_path?: string;
}

interface WidgetInfo {
  name: string;
  slug: string;
  description?: string;
  author?: string;
  created_at: string;
  updated_at: string;
  refresh_interval: number;
  default_size: { w: number; h: number };
  min_size: { w: number; h: number };
  credentials?: CredentialInfo[];
  fetch?: FetchInfo;
  setup?: SetupInfo;
  server_code_enabled: boolean;
  source_code?: string;
  server_code?: string;
}

interface CredentialStatus {
  [key: string]: boolean;
}

export function WidgetInfoModal({ open, onOpenChange, widgetSlug, widgetName }: WidgetInfoModalProps) {
  const [info, setInfo] = useState<WidgetInfo | null>(null);
  const [credentialStatus, setCredentialStatus] = useState<CredentialStatus>({});
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    metadata: true // Start with metadata expanded
  });
  const [codeView, setCodeView] = useState<'source' | 'server' | null>(null);

  useEffect(() => {
    if (open && widgetSlug) {
      setLoading(true);
      
      // Fetch widget info and credentials status in parallel
      Promise.all([
        fetch(`/api/widgets/${widgetSlug}`).then(res => res.json()),
        fetch('/api/credentials').then(res => res.json()).catch(() => ({ credentials: [] }))
      ]).then(([widgetData, credData]) => {
        setInfo(widgetData);
        
        // Build credential status map
        const statusMap: CredentialStatus = {};
        const configuredProviders = new Set(
          (credData.credentials || []).map((c: { provider: string }) => c.provider)
        );
        
        // Check each required credential
        if (widgetData.credentials) {
          for (const cred of widgetData.credentials) {
            // For local_software, we'd need to check via the server
            // For api_key, check if provider exists in credentials
            if (cred.type === 'api_key') {
              statusMap[cred.id] = configuredProviders.has(cred.id);
            } else if (cred.type === 'local_software') {
              // Assume configured if setup status is configured
              statusMap[cred.id] = widgetData.setup?.status === 'configured';
            } else if (cred.type === 'agent') {
              // Agent credentials can't be verified from the UI
              // Mark them specially - they'll show as "agent required"
              statusMap[cred.id] = false; // Will use special rendering
            }
          }
        }
        setCredentialStatus(statusMap);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [open, widgetSlug]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const countLines = (code?: string) => {
    if (!code) return 0;
    return code.split('\n').length;
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const Section = ({ title, icon: Icon, children, id, badge }: { 
    title: string; 
    icon: React.ElementType; 
    children: React.ReactNode; 
    id: string;
    badge?: React.ReactNode;
  }) => (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => toggleSection(id)}
        className="w-full px-3 py-2 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4" />
          {title}
          {badge}
        </div>
        {expandedSections[id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {expandedSections[id] && (
        <div className="px-3 py-3 text-sm space-y-2">
          {children}
        </div>
      )}
    </div>
  );

  const StatusBadge = ({ configured }: { configured: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
      configured 
        ? 'bg-green-500/20 text-green-400' 
        : 'bg-red-500/20 text-red-400'
    }`}>
      {configured ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {configured ? 'Configured' : 'Missing'}
    </span>
  );

  const FetchTypeIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'server_code': return <Server className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      case 'agent_refresh': return <Bot className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  // Code view modal
  if (codeView && info) {
    const code = codeView === 'source' ? info.source_code : info.server_code;
    const lines = countLines(code);
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{codeView === 'source' ? 'Widget Source Code' : 'Server Code'} ({lines} lines)</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(code || '')}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCodeView(null)}>
                  Back
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <pre className="bg-secondary/50 p-4 rounded-lg overflow-auto text-xs max-h-[60vh] font-mono">
            <code>{code || 'No code available'}</code>
          </pre>
        </DialogContent>
      </Dialog>
    );
  }

  // Agent credentials are always "required" (can't be verified), so we exclude them from the "all configured" check
  const nonAgentCredentials = info?.credentials?.filter(c => c.type !== 'agent') ?? [];
  const allCredentialsConfigured = nonAgentCredentials.length === 0 || nonAgentCredentials.every(c => credentialStatus[c.id]);
  const hasAgentCredentials = info?.credentials?.some(c => c.type === 'agent') ?? false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {widgetName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : info ? (
          <div className="space-y-3">
            
            {/* 1. METADATA */}
            <Section title="Metadata" icon={FileText} id="metadata">
              {info.description && (
                <p className="text-muted-foreground mb-3">{info.description}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slug</span>
                  <code className="bg-secondary px-1.5 rounded">{info.slug}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cache TTL</span>
                  <span>{formatDuration(info.refresh_interval)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Default Size</span>
                  <span>{info.default_size?.w}×{info.default_size?.h}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Size</span>
                  <span>{info.min_size?.w}×{info.min_size?.h}</span>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="text-xs space-y-1 text-muted-foreground">
                {info.author && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3" /> {info.author}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Created {formatDate(info.created_at)}
                </div>
                <div className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> Updated {formatDate(info.updated_at)}
                </div>
              </div>
            </Section>

            {/* 2. CREDENTIALS */}
            <Section 
              title="Credentials" 
              icon={Key} 
              id="credentials"
              badge={
                info.credentials && info.credentials.length > 0 ? (
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                    hasAgentCredentials 
                      ? 'bg-purple-500/20 text-purple-400'
                      : allCredentialsConfigured 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {hasAgentCredentials 
                      ? `${info.credentials.filter(c => c.type === 'agent').length} agent` 
                      : allCredentialsConfigured 
                        ? '✓ Ready' 
                        : `${nonAgentCredentials.filter(c => !credentialStatus[c.id]).length} missing`}
                  </span>
                ) : null
              }
            >
              {info.credentials && info.credentials.length > 0 ? (
                <div className="space-y-3">
                  {info.credentials.map((cred) => (
                    <div key={cred.id} className={`rounded-lg p-3 space-y-2 ${
                      cred.type === 'agent' 
                        ? 'bg-purple-500/10 border border-purple-500/20' 
                        : 'bg-secondary/30'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {cred.type === 'agent' && <Bot className="h-4 w-4 text-purple-500" />}
                            {cred.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {cred.type === 'api_key' && '🔑 API Key'}
                            {cred.type === 'local_software' && '💻 Local Software'}
                            {cred.type === 'oauth' && '🔐 OAuth'}
                            {cred.type === 'agent' && (
                              <span className="text-purple-400">
                                🤖 Agent Tool{cred.agent_tool && ` (${cred.agent_tool})`}
                              </span>
                            )}
                          </div>
                        </div>
                        {cred.type === 'agent' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400">
                            <Bot className="h-3 w-3" />
                            Agent Required
                          </span>
                        ) : (
                          <StatusBadge configured={credentialStatus[cred.id] ?? false} />
                        )}
                      </div>
                      {cred.description && (
                        <p className="text-xs text-muted-foreground">{cred.description}</p>
                      )}
                      {cred.check_command && (
                        <div className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded">
                          $ {cred.check_command}
                        </div>
                      )}
                      {cred.type === 'agent' && cred.agent_auth_check && (
                        <div className="text-xs font-mono bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20">
                          <span className="text-purple-400">Check:</span> $ {cred.agent_auth_check}
                        </div>
                      )}
                      {cred.type === 'agent' && cred.agent_auth_instructions && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-purple-400 hover:text-purple-300 font-medium">
                            How to authenticate
                          </summary>
                          <pre className="mt-2 bg-secondary/50 p-2 rounded overflow-auto max-h-32 text-[11px] whitespace-pre-wrap font-mono">
                            {cred.agent_auth_instructions}
                          </pre>
                        </details>
                      )}
                      <div className="flex gap-2">
                        {cred.obtain_url && (
                          <a href={cred.obtain_url} target="_blank" rel="noopener noreferrer" 
                             className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Get API Key
                          </a>
                        )}
                        {cred.install_url && (
                          <a href={cred.install_url} target="_blank" rel="noopener noreferrer" 
                             className="text-xs text-primary hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> Install Guide
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-2">No credentials required ✓</p>
              )}
            </Section>

            {/* 3. SETUP */}
            {info.setup && info.setup.status !== 'not_required' && (
              <Section title="Setup" icon={Settings} id="setup">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <StatusBadge configured={info.setup.status === 'configured'} />
                  </div>
                  {info.setup.description && (
                    <p className="text-muted-foreground">{info.setup.description}</p>
                  )}
                  {info.setup.verification && (
                    <div className="bg-secondary/30 rounded p-2 text-xs">
                      <div className="text-muted-foreground mb-1">Verification</div>
                      <code>{info.setup.verification.type}: {info.setup.verification.target}</code>
                    </div>
                  )}
                  {info.setup.estimated_time && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> ~{info.setup.estimated_time} to configure
                    </div>
                  )}
                  {info.setup.agent_skill && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-primary hover:underline font-medium">
                        View setup instructions for OpenClaw
                      </summary>
                      <pre className="mt-2 bg-secondary/50 p-3 rounded overflow-auto max-h-48 text-[11px] whitespace-pre-wrap font-mono">
                        {info.setup.agent_skill}
                      </pre>
                    </details>
                  )}
                </div>
              </Section>
            )}

            {/* 4. DATA FETCHING */}
            <Section title="Data Fetching" icon={Database} id="fetch">
              <div className="space-y-3">
                {/* Fetch Strategy */}
                <div className="bg-secondary/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FetchTypeIcon type={info.fetch?.type || 'server_code'} />
                    <span className="font-medium">
                      {info.fetch?.type === 'webhook' && 'Webhook Push'}
                      {info.fetch?.type === 'agent_refresh' && 'Agent Refresh'}
                      {(!info.fetch?.type || info.fetch?.type === 'server_code') && 'Server Code'}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {(!info.fetch?.type || info.fetch?.type === 'server_code') && (
                      <p>Executes server-side code to fetch data from external APIs on each refresh.</p>
                    )}
                    {info.fetch?.type === 'agent_refresh' && (
                      <>
                        <p>OpenClaw periodically runs a command to refresh the data.</p>
                        {info.fetch.refresh_command && (
                          <div className="font-mono bg-secondary/50 px-2 py-1 rounded mt-2">
                            $ {info.fetch.refresh_command}
                          </div>
                        )}
                      </>
                    )}
                    {info.fetch?.type === 'webhook' && (
                      <>
                        <p>Data is pushed to Glance via webhook from an external service.</p>
                        {info.fetch.webhook_path && (
                          <div className="font-mono bg-secondary/50 px-2 py-1 rounded mt-2">
                            POST {info.fetch.webhook_path}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Cache TTL */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Cache TTL</span>
                  <span className="font-medium">{formatDuration(info.refresh_interval)}</span>
                </div>
              </div>
            </Section>

            {/* 5. CODE */}
            <Section title="Code" icon={Code} id="code">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCodeView('source')}
                  disabled={!info.source_code}
                  className="h-auto py-3 flex-col"
                >
                  <Code className="h-5 w-5 mb-1" />
                  <span className="text-xs">Widget UI</span>
                  <span className="text-[10px] text-muted-foreground">{countLines(info.source_code)} lines</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCodeView('server')}
                  disabled={!info.server_code}
                  className="h-auto py-3 flex-col"
                >
                  <Server className="h-5 w-5 mb-1" />
                  <span className="text-xs">Server Code</span>
                  <span className="text-[10px] text-muted-foreground">{countLines(info.server_code)} lines</span>
                </Button>
              </div>
            </Section>

          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Could not load widget info
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
