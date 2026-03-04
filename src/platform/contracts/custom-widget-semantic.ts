import { PROVIDERS } from '../../lib/credentials.ts';
import type { ValidationIssue, CustomWidgetPayload, CustomWidgetUpdatePayload } from '../../lib/widget-contract.ts';
import { getDataProviderBySlug } from '../../lib/db.ts';
import { getCredentialById } from '../../lib/credentials.ts';

const RUNTIME_PROFILE_SAFE = 'safe';
const RUNTIME_PROFILE_NETWORKED = 'networked';

function issue(path: string, code: string, message: string): ValidationIssue {
  return { path, code, message };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function providerFromServerCode(serverCode: string | null | undefined): string[] {
  if (!serverCode) {
    return [];
  }

  const matches = [...serverCode.matchAll(/getCredential\(\s*['\"]([a-z0-9-]+)['\"]\s*\)/g)];
  return unique(matches.map((m) => m[1]));
}

export function inferRequiredCredentialProviders(payload: Pick<CustomWidgetPayload, 'required_credentials' | 'data_providers' | 'permissions' | 'server_code'>): string[] {
  const inferred = new Set<string>();

  for (const provider of payload.required_credentials || []) {
    inferred.add(provider);
  }

  for (const provider of payload.permissions?.credential_providers || []) {
    inferred.add(provider);
  }

  for (const provider of payload.data_providers || []) {
    if (provider in PROVIDERS) {
      inferred.add(provider);
    }

    const dataProvider = getDataProviderBySlug(provider);
    if (dataProvider?.credential_id) {
      const credential = getCredentialById(dataProvider.credential_id);
      if (credential?.provider) {
        inferred.add(credential.provider);
      }
    }
  }

  for (const provider of providerFromServerCode(payload.server_code)) {
    inferred.add(provider);
  }

  return [...inferred];
}

export function validateCustomWidgetSemantics(
  payload: CustomWidgetPayload | CustomWidgetUpdatePayload,
  context?: { existing?: CustomWidgetPayload }
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const merged: CustomWidgetPayload = {
    ...(context?.existing || {
      name: 'existing',
      source_code: 'noop',
    }),
    ...payload,
  };

  const runtimeProfile =
    merged.runtime_profile ||
    ((merged.data_providers?.length || 0) > 0 || merged.permissions?.allow_network === true
      ? RUNTIME_PROFILE_NETWORKED
      : RUNTIME_PROFILE_SAFE);
  const allowNetwork = merged.permissions?.allow_network === true;

  if (runtimeProfile !== RUNTIME_PROFILE_SAFE && runtimeProfile !== RUNTIME_PROFILE_NETWORKED) {
    issues.push(issue('$.runtime_profile', 'enum', 'Expected one of safe, networked'));
  }

  if (runtimeProfile === RUNTIME_PROFILE_SAFE && allowNetwork) {
    issues.push(issue('$.permissions.allow_network', 'conflict', 'safe runtime_profile cannot allow network access'));
  }

  if ((merged.data_providers?.length || 0) > 0 && merged.runtime_profile === RUNTIME_PROFILE_SAFE) {
    issues.push(issue('$.runtime_profile', 'conflict', 'Widgets using data_providers cannot set runtime_profile="safe"'));
  }

  const requiredProviders = inferRequiredCredentialProviders(merged);
  for (const provider of requiredProviders) {
    if (!(provider in PROVIDERS)) {
      issues.push(issue('$.required_credentials', 'unknown_provider', `Unknown credential provider "${provider}"`));
    }
  }

  for (const slug of merged.data_providers || []) {
    const provider = getDataProviderBySlug(slug);
    if (!provider && !(slug in PROVIDERS)) {
      issues.push(issue('$.data_providers', 'unknown_data_provider', `Unknown data provider "${slug}"`));
      continue;
    }

    if (!provider) {
      continue;
    }

    if (provider.auth_type !== 'none' && !provider.credential_id) {
      issues.push(issue('$.data_providers', 'missing_credential', `Data provider "${slug}" requires credential_id`));
      continue;
    }

    if (provider.credential_id) {
      const credential = getCredentialById(provider.credential_id);
      if (!credential) {
        issues.push(issue('$.data_providers', 'invalid_credential_reference', `credential_id for "${slug}" does not exist`));
      }
    }
  }

  return issues;
}
