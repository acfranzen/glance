import type { CustomWidgetPayload, CustomWidgetUpdatePayload, WidgetPayload, WidgetUpdatePayload } from '../../lib/widget-contract.ts';
import { validateContract, failSemantic, failValidation, type ContractGateResult } from './schema-registry.ts';
import { validateCustomWidgetSemantics } from './custom-widget-semantic.ts';
import type { ArtifactCreatePayload, PackInstallPayload, WorkspaceCreatePayload } from './platform-contract.ts';
import { validateArtifactSemantic } from './platform-contract.ts';

export function validateWidgetCreateGate(input: unknown): ContractGateResult<WidgetPayload> {
  const result = validateContract('widget.create', input);
  if (!result.ok) {
    return { ok: false, failure: failValidation('Invalid widget create payload', result.issues) };
  }
  return { ok: true, value: result.value };
}

export function validateWidgetUpdateGate(input: unknown): ContractGateResult<WidgetUpdatePayload> {
  const result = validateContract('widget.update', input);
  if (!result.ok) {
    return { ok: false, failure: failValidation('Invalid widget update payload', result.issues) };
  }
  return { ok: true, value: result.value };
}

export function validateCustomWidgetCreateGate(input: unknown): ContractGateResult<CustomWidgetPayload> {
  const result = validateContract('customWidget.create', input);
  if (!result.ok || !result.value) {
    return { ok: false, failure: failValidation('Invalid custom widget create payload', result.issues) };
  }

  const semanticIssues = validateCustomWidgetSemantics(result.value);
  if (semanticIssues.length > 0) {
    return { ok: false, failure: failSemantic('Custom widget payload failed semantic checks', semanticIssues) };
  }

  return { ok: true, value: result.value };
}

export function validateCustomWidgetUpdateGate(
  input: unknown,
  existing?: CustomWidgetPayload
): ContractGateResult<CustomWidgetUpdatePayload> {
  const result = validateContract('customWidget.update', input);
  if (!result.ok || !result.value) {
    return { ok: false, failure: failValidation('Invalid custom widget update payload', result.issues) };
  }

  const semanticIssues = validateCustomWidgetSemantics(result.value, { existing });
  if (semanticIssues.length > 0) {
    return { ok: false, failure: failSemantic('Custom widget update failed semantic checks', semanticIssues) };
  }

  return { ok: true, value: result.value };
}

export function validateWorkspaceCreateGate(input: unknown): ContractGateResult<WorkspaceCreatePayload> {
  const result = validateContract('workspace.create', input);
  if (!result.ok || !result.value) {
    return { ok: false, failure: failValidation('Invalid workspace create payload', result.issues) };
  }
  return { ok: true, value: result.value };
}

export function validateArtifactCreateGate(input: unknown): ContractGateResult<ArtifactCreatePayload> {
  const result = validateContract('artifact.create', input);
  if (!result.ok || !result.value) {
    return { ok: false, failure: failValidation('Invalid artifact create payload', result.issues) };
  }

  const semanticIssues = validateArtifactSemantic(result.value.manifest);
  if (semanticIssues.length > 0) {
    return { ok: false, failure: failSemantic('Artifact payload failed semantic checks', semanticIssues) };
  }

  return { ok: true, value: result.value };
}

export function validatePackInstallGate(input: unknown): ContractGateResult<PackInstallPayload> {
  const result = validateContract('pack.install', input);
  if (!result.ok || !result.value) {
    return { ok: false, failure: failValidation('Invalid pack install payload', result.issues) };
  }
  return { ok: true, value: result.value };
}
