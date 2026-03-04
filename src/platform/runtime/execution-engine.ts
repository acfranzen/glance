export interface ExecutionTarget {
  type: 'custom-widget-server-code';
  id: string;
  workspace_id: string;
}

export interface ExecutionRequest {
  actor: string;
  target: ExecutionTarget;
  input: Record<string, unknown>;
  timeout_ms?: number;
}

export interface ExecutionResult {
  status: 'succeeded' | 'failed';
  output: unknown;
  error?: string;
  finished_at: string;
  cost_hint?: number | null;
}

export interface ExecutionEngine {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}
