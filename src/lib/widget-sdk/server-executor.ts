import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { getCredentialByProvider, isBuiltInProvider } from '@/lib/credentials';
import { FetchConfig } from '@/lib/db';

export interface ServerExecutorParams {
  [key: string]: unknown;
}

export interface ServerExecutorResult {
  data: unknown;
  error: string | null;
}

export interface ServerExecutorOptions {
  params?: ServerExecutorParams;
  timeout?: number;
  fetchConfig?: FetchConfig;
}

// Allowed cache paths (for security - only allow specific directories)
const ALLOWED_CACHE_DIRS = [
  '/tmp',
  process.env.HOME ? path.join(process.env.HOME, '.glance', 'cache') : null,
].filter(Boolean) as string[];

// Dangerous patterns that should be blocked in server code
const DANGEROUS_PATTERNS = [
  /\brequire\s*\(/,           // No require()
  /\bimport\s*\(/,            // No dynamic import()
  /\bimport\s+/,              // No static imports
  /\beval\s*\(/,              // No eval
  /\bnew\s+Function\s*\(/,    // No new Function
  /\bprocess\b/,              // No process access
  /\bBuffer\b/,               // No Buffer (could be used for exploits)
  /\b__dirname\b/,            // No __dirname
  /\b__filename\b/,           // No __filename
  /\bglobal\b/,               // No global object
  /\bglobalThis\b/,           // No globalThis
  /\bfs\b/,                   // No filesystem hints
  /\bchild_process\b/,        // No child process hints
  /\bexec\b/,                 // No exec
  /\bspawn\b/,                // No spawn
];

/**
 * Strip strings and comments for pattern matching
 */
function stripStringsAndComments(code: string): string {
  return code
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')   // Remove double-quoted strings
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''")   // Remove single-quoted strings
    .replace(/`[^`\\]*(?:\\.[^`\\]*)*`/g, '``')   // Remove template literals
    .replace(/\/\/.*$/gm, '')                      // Remove single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');            // Remove multi-line comments
}

/**
 * Validate server code for dangerous patterns
 */
export function validateServerCode(code: string): { valid: boolean; error?: string } {
  const strippedCode = stripStringsAndComments(code);

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(strippedCode)) {
      return {
        valid: false,
        error: `Forbidden pattern detected: ${pattern.source}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Create a safe getCredential function for the sandbox
 * Now supports both built-in and custom providers
 */
function createSafeGetCredential() {
  return async (provider: string): Promise<string | null> => {
    // For built-in providers, validate they exist
    if (isBuiltInProvider(provider)) {
      return getCredentialByProvider(provider);
    }
    // For custom providers, just try to get the credential
    // Widget packages can define custom credentials
    return getCredentialByProvider(provider);
  };
}

/**
 * Check if a path is within allowed cache directories
 */
function isPathAllowed(filePath: string, allowedCachePath?: string): boolean {
  const normalizedPath = path.normalize(filePath);
  
  // If a specific cache path is provided (from widget's fetch config), check against it
  if (allowedCachePath) {
    const normalizedAllowed = path.normalize(allowedCachePath);
    return normalizedPath === normalizedAllowed;
  }
  
  // Otherwise check against allowed directories
  return ALLOWED_CACHE_DIRS.some(dir => normalizedPath.startsWith(dir + path.sep) || normalizedPath.startsWith(dir));
}

/**
 * Create a safe readCacheFile function for the sandbox
 * Only allows reading from specified cache paths in /tmp
 */
function createSafeReadCacheFile() {
  return async (filePath: string): Promise<string | null> => {
    // Validate the path is allowed (only /tmp paths)
    if (!isPathAllowed(filePath)) {
      throw new Error(`Cache path not allowed: ${filePath}. Only paths in /tmp are permitted.`);
    }

    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      console.error('[server-code] Failed to read cache file:', error);
      return null;
    }
  };
}

/**
 * Execute server-side code in a VM sandbox
 *
 * @param serverCode - The JavaScript code to execute (must return a value or use async/await)
 * @param options - Execution options including params, timeout, and fetchConfig
 */
export async function executeServerCode(
  serverCode: string,
  options: ServerExecutorOptions = {}
): Promise<ServerExecutorResult> {
  const { params = {}, timeout = 5000 } = options;

  // Validate patterns first
  const validation = validateServerCode(serverCode);
  if (!validation.valid) {
    return {
      data: null,
      error: validation.error || 'Invalid server code',
    };
  }

  try {
    // Create the sandbox context with allowed globals
    const sandbox: vm.Context = {
      // Safe built-ins
      JSON,
      Date,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Promise,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Symbol,
      BigInt,
      Infinity,
      NaN,
      undefined,
      isNaN,
      isFinite,
      parseFloat,
      parseInt,
      decodeURI,
      decodeURIComponent,
      encodeURI,
      encodeURIComponent,

      // Async utilities
      setTimeout: (fn: () => void, ms: number) => {
        // Limit setTimeout to prevent long delays
        const limitedMs = Math.min(ms, timeout);
        return setTimeout(fn, limitedMs);
      },
      clearTimeout,

      // Network access (sandboxed by nature - can only make HTTP requests)
      fetch,

      // Credential access (safe wrapper - supports both built-in and custom providers)
      getCredential: createSafeGetCredential(),

      // Cache file access (safe wrapper - only allows /tmp paths)
      readCacheFile: createSafeReadCacheFile(),

      // Params from the widget
      params,

      // Console for debugging (output is captured)
      console: {
        log: (...args: unknown[]) => console.log('[server-code]', ...args),
        warn: (...args: unknown[]) => console.warn('[server-code]', ...args),
        error: (...args: unknown[]) => console.error('[server-code]', ...args),
      },

      // Block dangerous globals by setting them to undefined
      require: undefined,
      import: undefined,
      eval: undefined,
      Function: undefined,
      process: undefined,
      Buffer: undefined,
      __dirname: undefined,
      __filename: undefined,
      global: undefined,
      globalThis: undefined,
      module: undefined,
      exports: undefined,
    };

    // Create the VM context
    vm.createContext(sandbox);

    // Wrap the code in an async function to allow await
    const wrappedCode = `
      (async () => {
        ${serverCode}
      })()
    `;

    // Compile the script
    const script = new vm.Script(wrappedCode, {
      filename: 'server-code.js',
    });

    // Execute with timeout
    const resultPromise = script.runInContext(sandbox, {
      timeout,
      displayErrors: true,
    }) as Promise<unknown>;

    // Wait for the result with an additional timeout wrapper
    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Execution timeout')), timeout + 100)
      ),
    ]);

    return {
      data: result,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
    console.error('[server-executor] Execution error:', errorMessage);

    return {
      data: null,
      error: errorMessage,
    };
  }
}
