import {
  type ValidationIssue,
  type ValidationResult,
  type WidgetPayload,
  type WidgetUpdatePayload,
  type CustomWidgetPayload,
  type CustomWidgetUpdatePayload,
  validateWidgetCreatePayload,
  validateWidgetUpdatePayload,
  validateStoredWidgetPayload,
  validateCustomWidgetCreatePayload,
  validateCustomWidgetUpdatePayload,
  validateStoredCustomWidgetPayload,
} from '../../lib/widget-contract.ts';
import {
  type WorkspaceCreatePayload,
  type ArtifactCreatePayload,
  type PackInstallPayload,
  validateWorkspaceCreatePayload,
  validateArtifactCreatePayload,
  validatePackInstallPayload,
} from './platform-contract.ts';

export type ContractName =
  | 'widget.create'
  | 'widget.update'
  | 'widget.stored'
  | 'customWidget.create'
  | 'customWidget.update'
  | 'customWidget.stored'
  | 'workspace.create'
  | 'artifact.create'
  | 'pack.install';

export type ContractValueByName = {
  'widget.create': WidgetPayload;
  'widget.update': WidgetUpdatePayload;
  'widget.stored': WidgetPayload;
  'customWidget.create': CustomWidgetPayload;
  'customWidget.update': CustomWidgetUpdatePayload;
  'customWidget.stored': CustomWidgetPayload;
  'workspace.create': WorkspaceCreatePayload;
  'artifact.create': ArtifactCreatePayload;
  'pack.install': PackInstallPayload;
};

type ContractValidator<T> = (input: unknown) => ValidationResult<T>;

const REGISTRY: { [K in ContractName]: ContractValidator<ContractValueByName[K]> } = {
  'widget.create': validateWidgetCreatePayload,
  'widget.update': validateWidgetUpdatePayload,
  'widget.stored': validateStoredWidgetPayload,
  'customWidget.create': validateCustomWidgetCreatePayload,
  'customWidget.update': validateCustomWidgetUpdatePayload,
  'customWidget.stored': validateStoredCustomWidgetPayload,
  'workspace.create': validateWorkspaceCreatePayload,
  'artifact.create': validateArtifactCreatePayload,
  'pack.install': validatePackInstallPayload,
};

export function validateContract<K extends ContractName>(name: K, input: unknown): ValidationResult<ContractValueByName[K]> {
  return REGISTRY[name](input);
}

export interface ContractGateFailure {
  code: 'VALIDATION_ERROR' | 'SEMANTIC_CONTRACT_ERROR';
  message: string;
  details: ValidationIssue[];
}

export interface ContractGateResult<T> {
  ok: boolean;
  value?: T;
  failure?: ContractGateFailure;
}

export function failValidation(message: string, details: ValidationIssue[]): ContractGateFailure {
  return { code: 'VALIDATION_ERROR', message, details };
}

export function failSemantic(message: string, details: ValidationIssue[]): ContractGateFailure {
  return { code: 'SEMANTIC_CONTRACT_ERROR', message, details };
}
