const SECRET_PATTERNS: RegExp[] = [
  /(Bearer\s+)[A-Za-z0-9._\-~+/]+=*/gi,
  /(gh[pousr]_[A-Za-z0-9_]{20,})/g,
  /(sk-[A-Za-z0-9]{20,})/g,
  /(xox[baprs]-[A-Za-z0-9-]{20,})/g,
  /([A-Za-z0-9+\/]{32,}={0,2})/g,
];

export function redactSecrets(input: string): string {
  let output = input;
  output = output.replace(/"(token|api[_-]?key|password|secret|authorization)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, (match: string, prefix?: string) => {
      if (prefix) {
        return `${prefix}[REDACTED]`;
      }
      return '[REDACTED]';
    });
  }
  return output;
}

export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSecrets(error.message);
  }
  return redactSecrets(String(error));
}

export function sanitizeForLog(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSecrets(value);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSecrets(value.message),
      stack: value.stack ? redactSecrets(value.stack) : undefined,
    };
  }
  try {
    return JSON.parse(redactSecrets(JSON.stringify(value)));
  } catch {
    return redactSecrets(String(value));
  }
}
