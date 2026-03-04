import type { ExecutionEngine, ExecutionRequest, ExecutionResult } from '@/platform/runtime/execution-engine';
import { executeServerCode } from '@/lib/widget-sdk/server-executor';

export class LegacyRuntimeExecutionAdapter implements ExecutionEngine {
  constructor(private readonly serverCode: string) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const timeout = request.timeout_ms ?? 5000;
    const result = await executeServerCode(this.serverCode, request.input, timeout);

    if (result.error) {
      return {
        status: 'failed',
        output: null,
        error: result.error,
        finished_at: new Date().toISOString(),
      };
    }

    return {
      status: 'succeeded',
      output: result.data,
      finished_at: new Date().toISOString(),
    };
  }
}
