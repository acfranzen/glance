'use client';

import { transform } from 'sucrase';

export interface TranspileResult {
  code: string;
  error: Error | null;
}

/**
 * Transpile JSX source code to JavaScript using Sucrase
 * 
 * Sucrase is faster and lighter than Babel for simple JSX transforms
 */
export function transpileJSX(sourceCode: string): TranspileResult {
  try {
    // Validate that source code doesn't contain dangerous patterns
    const dangerousPatterns = [
      /\bimport\s+/,  // No imports (must use provided context)
      /\brequire\s*\(/,  // No require
      /\beval\s*\(/,  // No eval
      /\bnew\s+Function\s*\(/,  // No new Function
      /\bwindow\b/,  // No window access
      /\bdocument\b/,  // No document access (except in JSX which is fine)
      /\bnavigator\b/,  // No navigator
      /\blocalStorage\b/,  // No localStorage
      /\bsessionStorage\b/,  // No sessionStorage
      // fetch is allowed - CORS provides natural sandboxing in browser
      /\bXMLHttpRequest\b/,  // No XHR
      /\bWebSocket\b/,  // No WebSocket
    ];

    // Check for dangerous patterns (but allow them in strings/comments)
    for (const pattern of dangerousPatterns) {
      // Simple check - strip strings and comments first
      const strippedCode = sourceCode
        .replace(/"[^"]*"/g, '""')  // Remove double-quoted strings
        .replace(/'[^']*'/g, "''")  // Remove single-quoted strings
        .replace(/`[^`]*`/g, '``')  // Remove template literals (simplified)
        .replace(/\/\/.*$/gm, '')   // Remove single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      if (pattern.test(strippedCode)) {
        throw new Error(`Forbidden pattern detected: ${pattern.source}. Use provided hooks instead.`);
      }
    }

    // Transpile JSX to JavaScript using Sucrase
    const result = transform(sourceCode, {
      transforms: ['jsx'],
      jsxRuntime: 'classic',
      production: true,
    });

    if (!result || !result.code) {
      throw new Error('Transpilation produced no output');
    }

    return {
      code: result.code,
      error: null,
    };
  } catch (error) {
    return {
      code: '',
      error: error instanceof Error ? error : new Error('Unknown transpilation error'),
    };
  }
}

/**
 * Pre-transpile source code for caching
 * Returns the transpiled code or throws an error
 */
export function preTranspile(sourceCode: string): string {
  const result = transpileJSX(sourceCode);
  if (result.error) {
    throw result.error;
  }
  return result.code;
}
