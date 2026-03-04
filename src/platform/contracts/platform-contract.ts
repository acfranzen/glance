import type { ValidationIssue, ValidationResult } from '../../lib/widget-contract.ts';

export interface WorkspaceCreatePayload {
  name: string;
  slug?: string;
}

export interface ArtifactManifestPayload {
  manifest_version: string;
  widget_slug: string;
  widget_version: string;
  runtime_profile: 'safe' | 'networked';
  permissions?: {
    allow_network?: boolean;
    credential_providers?: string[];
  };
  required_secrets?: string[];
  egress_domains?: string[];
  trust_level?: 'official' | 'verified' | 'community';
  readme?: string;
}

export interface ArtifactCreatePayload {
  workspace_id?: string;
  type?: 'widget-pack' | 'dashboard-template';
  title: string;
  manifest: ArtifactManifestPayload;
  metadata?: Record<string, unknown>;
}

export interface PackInstallPayload {
  artifact_id: string;
  workspace_id?: string;
}

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSlug(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
}

function validateString(value: unknown, path: string, min: number, max: number, issues: ValidationIssue[]): value is string {
  if (typeof value !== 'string') {
    issues.push(issue(path, 'type', 'Expected string'));
    return false;
  }
  if (value.length < min) {
    issues.push(issue(path, 'min_length', `Must be at least ${min} characters`));
  }
  if (value.length > max) {
    issues.push(issue(path, 'max_length', `Must be at most ${max} characters`));
  }
  return true;
}

export function validateWorkspaceCreatePayload(input: unknown): ValidationResult<WorkspaceCreatePayload> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue('$', 'type', 'Expected object')] };
  }

  const keys = new Set(['name', 'slug']);
  for (const key of Object.keys(input)) {
    if (!keys.has(key)) {
      issues.push(issue(`$.${key}`, 'unexpected_property', `Unexpected property "${key}"`));
    }
  }

  validateString(input.name, '$.name', 1, 80, issues);
  if (input.slug !== undefined && !isSlug(input.slug)) {
    issues.push(issue('$.slug', 'pattern', 'Expected kebab-case slug'));
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, issues, value: { name: input.name as string, slug: input.slug as string | undefined } };
}

function validateSlugArray(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'type', 'Expected array'));
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (!isSlug(value[i])) {
      issues.push(issue(`${path}[${i}]`, 'pattern', 'Expected kebab-case slug'));
    }
  }
}

function validateDomainArray(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!Array.isArray(value)) {
    issues.push(issue(path, 'type', 'Expected array'));
    return;
  }
  for (let i = 0; i < value.length; i += 1) {
    if (typeof value[i] !== 'string' || value[i].trim().length === 0 || value[i].includes(' ')) {
      issues.push(issue(`${path}[${i}]`, 'pattern', 'Expected hostname/domain'));
    }
  }
}

export function validateArtifactCreatePayload(input: unknown): ValidationResult<ArtifactCreatePayload> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue('$', 'type', 'Expected object')] };
  }

  const allowed = new Set(['workspace_id', 'type', 'title', 'manifest', 'metadata']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      issues.push(issue(`$.${key}`, 'unexpected_property', `Unexpected property "${key}"`));
    }
  }

  if (input.workspace_id !== undefined && !isSafeId(input.workspace_id)) {
    issues.push(issue('$.workspace_id', 'pattern', 'Expected safe id'));
  }
  if (input.type !== undefined && input.type !== 'widget-pack' && input.type !== 'dashboard-template') {
    issues.push(issue('$.type', 'enum', 'Expected "widget-pack" or "dashboard-template"'));
  }
  validateString(input.title, '$.title', 1, 120, issues);

  if (!isRecord(input.manifest)) {
    issues.push(issue('$.manifest', 'type', 'Expected object'));
  } else {
    const manifest = input.manifest;
    validateString(manifest.manifest_version, '$.manifest.manifest_version', 1, 20, issues);
    if (!isSlug(manifest.widget_slug)) {
      issues.push(issue('$.manifest.widget_slug', 'pattern', 'Expected kebab-case slug'));
    }
    validateString(manifest.widget_version, '$.manifest.widget_version', 1, 40, issues);
    if (manifest.runtime_profile !== 'safe' && manifest.runtime_profile !== 'networked') {
      issues.push(issue('$.manifest.runtime_profile', 'enum', 'Expected "safe" or "networked"'));
    }
    if (manifest.permissions !== undefined) {
      if (!isRecord(manifest.permissions)) {
        issues.push(issue('$.manifest.permissions', 'type', 'Expected object'));
      } else {
        if (
          manifest.permissions.allow_network !== undefined &&
          typeof manifest.permissions.allow_network !== 'boolean'
        ) {
          issues.push(issue('$.manifest.permissions.allow_network', 'type', 'Expected boolean'));
        }
        if (manifest.permissions.credential_providers !== undefined) {
          validateSlugArray(manifest.permissions.credential_providers, '$.manifest.permissions.credential_providers', issues);
        }
      }
    }
    if (manifest.required_secrets !== undefined) {
      validateSlugArray(manifest.required_secrets, '$.manifest.required_secrets', issues);
    }
    if (manifest.egress_domains !== undefined) {
      validateDomainArray(manifest.egress_domains, '$.manifest.egress_domains', issues);
    }
    if (
      manifest.trust_level !== undefined &&
      !['official', 'verified', 'community'].includes(String(manifest.trust_level))
    ) {
      issues.push(issue('$.manifest.trust_level', 'enum', 'Expected official, verified, or community'));
    }
    if (manifest.readme !== undefined) {
      validateString(manifest.readme, '$.manifest.readme', 0, 10_000, issues);
    }
  }

  if (input.metadata !== undefined && !isRecord(input.metadata)) {
    issues.push(issue('$.metadata', 'type', 'Expected object'));
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    issues,
    value: {
      workspace_id: input.workspace_id as string | undefined,
      type: (input.type as 'widget-pack' | 'dashboard-template' | undefined) || 'widget-pack',
      title: input.title as string,
      manifest: input.manifest as ArtifactManifestPayload,
      metadata: input.metadata as Record<string, unknown> | undefined,
    },
  };
}

export function validatePackInstallPayload(input: unknown): ValidationResult<PackInstallPayload> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return { ok: false, issues: [issue('$', 'type', 'Expected object')] };
  }

  const allowed = new Set(['artifact_id', 'workspace_id']);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      issues.push(issue(`$.${key}`, 'unexpected_property', `Unexpected property "${key}"`));
    }
  }

  if (typeof input.artifact_id !== 'string' || input.artifact_id.trim().length < 3) {
    issues.push(issue('$.artifact_id', 'type', 'Expected artifact_id string'));
  }
  if (input.workspace_id !== undefined && !isSafeId(input.workspace_id)) {
    issues.push(issue('$.workspace_id', 'pattern', 'Expected safe id'));
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    issues,
    value: { artifact_id: input.artifact_id as string, workspace_id: input.workspace_id as string | undefined },
  };
}

export function validateArtifactSemantic(manifest: ArtifactManifestPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowNetwork = manifest.permissions?.allow_network === true;
  const hasEgress = (manifest.egress_domains || []).length > 0;

  if (manifest.runtime_profile === 'safe' && (allowNetwork || hasEgress)) {
    issues.push(issue('$.manifest.runtime_profile', 'conflict', 'safe runtime_profile cannot allow network/egress'));
  }

  if (manifest.runtime_profile === 'networked' && !allowNetwork) {
    issues.push(issue('$.manifest.permissions.allow_network', 'required', 'networked profile should set allow_network=true'));
  }

  return issues;
}
