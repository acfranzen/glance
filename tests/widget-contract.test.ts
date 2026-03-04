import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCustomWidgetCreatePayload,
  validateWidgetCreatePayload,
  validateWidgetUpdatePayload,
} from '../src/lib/widget-contract.ts';

test('validateWidgetCreatePayload accepts valid widget payload', () => {
  const result = validateWidgetCreatePayload({
    type: 'claude_max_usage',
    title: 'Claude Max Usage',
    config: {},
    position: { x: 0, y: 0, w: 4, h: 3 },
    data_source: { type: 'static' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test('validateWidgetCreatePayload rejects invalid widget payload', () => {
  const result = validateWidgetCreatePayload({
    type: 'unknown_type',
    title: '',
    config: 'bad',
    position: { x: -1, y: 0, w: 99, h: 0 },
    extra: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === '$.extra'));
  assert.ok(result.issues.some((issue) => issue.path === '$.type'));
  assert.ok(result.issues.some((issue) => issue.path === '$.position.w'));
});

test('validateWidgetUpdatePayload rejects empty update object', () => {
  const result = validateWidgetUpdatePayload({});

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === '$'));
});

test('validateCustomWidgetCreatePayload accepts valid custom widget payload', () => {
  const result = validateCustomWidgetCreatePayload({
    name: 'GitHub PRs',
    slug: 'github-prs',
    source_code: 'function Widget() { return null; }',
    default_size: { w: 4, h: 3 },
    min_size: { w: 2, h: 2 },
    data_providers: ['github'],
    refresh_interval: 300,
    server_code_enabled: false,
  });

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test('validateCustomWidgetCreatePayload rejects invalid custom widget payload', () => {
  const result = validateCustomWidgetCreatePayload({
    name: '',
    slug: 'Bad Slug',
    source_code: '',
    default_size: { w: 20, h: 3 },
    min_size: { w: 30, h: 2 },
    data_providers: ['bad slug'],
    refresh_interval: 1,
    server_code_enabled: true,
    server_code: null,
    unknown: true,
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === '$.unknown'));
  assert.ok(result.issues.some((issue) => issue.path === '$.slug'));
  assert.ok(result.issues.some((issue) => issue.path === '$.refresh_interval'));
  assert.ok(result.issues.some((issue) => issue.path === '$.server_code'));
});

test('validateCustomWidgetCreatePayload accepts runtime and permission metadata', () => {
  const result = validateCustomWidgetCreatePayload({
    name: 'GitHub Open PRs',
    slug: 'github-open-prs',
    source_code: 'function Widget() { return null; }',
    data_providers: ['github'],
    runtime_profile: 'networked',
    required_credentials: ['github'],
    permissions: {
      credential_providers: ['github'],
      data_providers: ['github'],
      allow_network: true,
    },
  });

  assert.equal(result.ok, true);
});

test('validateCustomWidgetCreatePayload rejects invalid runtime and permissions metadata', () => {
  const result = validateCustomWidgetCreatePayload({
    name: 'Broken Metadata',
    slug: 'broken-metadata',
    source_code: 'function Widget() { return null; }',
    runtime_profile: 'fast',
    required_credentials: ['bad slug'],
    permissions: {
      allow_network: 'yes',
      unknown: true,
    },
  });

  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === '$.runtime_profile'));
  assert.ok(result.issues.some((issue) => issue.path === '$.required_credentials[0]'));
  assert.ok(result.issues.some((issue) => issue.path === '$.permissions.unknown'));
  assert.ok(result.issues.some((issue) => issue.path === '$.permissions.allow_network'));
});
