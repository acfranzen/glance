import { NextResponse } from 'next/server';
import type { ValidationIssue } from '@/lib/widget-contract';

export function validationErrorResponse(message: string, issues: ValidationIssue[]) {
  return contractErrorResponse('VALIDATION_ERROR', message, issues);
}

export function contractErrorResponse(
  code: 'VALIDATION_ERROR' | 'SEMANTIC_CONTRACT_ERROR',
  message: string,
  issues: ValidationIssue[]
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: issues,
      },
    },
    { status: 422 }
  );
}
