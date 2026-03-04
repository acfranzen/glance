import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets, sanitizeErrorMessage, sanitizeForLog } from '../src/lib/security.ts';

test('redactSecrets masks common token formats', () => {
  const input = 'Authorization: Bearer sk-abc12345678901234567890';
  const output = redactSecrets(input);
  assert.equal(output.includes('[REDACTED]'), true);
});

test('sanitizeErrorMessage redacts secret-like values', () => {
  const message = sanitizeErrorMessage(new Error('token=ghp_abcdefghijklmnopqrstuvwxyz1234'));
  assert.equal(message.includes('[REDACTED]'), true);
});

test('sanitizeForLog redacts nested structured values', () => {
  const sanitized = sanitizeForLog({
    authorization: 'Bearer supersecretvalue',
    nested: { api_key: 'my-key' },
  }) as { authorization?: string; nested?: { api_key?: string } };

  assert.equal(sanitized.authorization?.includes('REDACTED'), true);
  assert.equal(sanitized.nested?.api_key, '[REDACTED]');
});
