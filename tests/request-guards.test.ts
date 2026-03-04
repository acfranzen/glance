import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, isContentLengthTooLarge } from '../src/lib/request-guards.ts';

test('isContentLengthTooLarge handles missing and invalid values', () => {
  assert.equal(isContentLengthTooLarge(null, 100), false);
  assert.equal(isContentLengthTooLarge('invalid', 100), false);
  assert.equal(isContentLengthTooLarge('99', 100), false);
  assert.equal(isContentLengthTooLarge('101', 100), true);
});

test('checkRateLimit enforces window limits', async () => {
  const key = `test-key-${Date.now()}`;
  const opts = { key, limit: 2, windowMs: 50 };

  assert.equal(checkRateLimit(opts).allowed, true);
  assert.equal(checkRateLimit(opts).allowed, true);
  const third = checkRateLimit(opts);
  assert.equal(third.allowed, false);
  assert.equal(typeof third.retryAfterSec, 'number');

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(checkRateLimit(opts).allowed, true);
});

