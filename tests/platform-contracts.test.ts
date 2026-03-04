import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateArtifactCreatePayload,
  validateArtifactSemantic,
  validatePackInstallPayload,
  validateWorkspaceCreatePayload,
} from '../src/platform/contracts/platform-contract.ts';

test('validateWorkspaceCreatePayload accepts valid payload', () => {
  const result = validateWorkspaceCreatePayload({ name: 'Product', slug: 'product' });
  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
});

test('validateWorkspaceCreatePayload rejects invalid payload', () => {
  const result = validateWorkspaceCreatePayload({ name: '', slug: 'Bad Slug' });
  assert.equal(result.ok, false);
});

test('validateArtifactCreatePayload accepts valid widget-pack payload', () => {
  const result = validateArtifactCreatePayload({
    workspace_id: 'ws_default',
    type: 'widget-pack',
    title: 'GitHub PR Pack',
    manifest: {
      manifest_version: 'v1',
      widget_slug: 'github-prs',
      widget_version: '1.0.0',
      runtime_profile: 'networked',
      permissions: { allow_network: true, credential_providers: ['github'] },
      required_secrets: ['github'],
      egress_domains: ['api.github.com'],
      trust_level: 'community',
    },
  });

  assert.equal(result.ok, true);
});

test('validateArtifactCreateGate enforces semantic safety rules', () => {
  const result = validateArtifactCreatePayload({
    type: 'widget-pack',
    title: 'Unsafe Pack',
    manifest: {
      manifest_version: 'v1',
      widget_slug: 'unsafe-pack',
      widget_version: '1.0.0',
      runtime_profile: 'safe',
      permissions: { allow_network: true },
      egress_domains: ['api.example.com'],
    },
  });

  assert.equal(result.ok, true);
  const semanticIssues = validateArtifactSemantic(result.value!.manifest);
  assert.equal(semanticIssues.length > 0, true);
});

test('validatePackInstallPayload requires artifact id', () => {
  const result = validatePackInstallPayload({ workspace_id: 'ws_default' });
  assert.equal(result.ok, false);
});

test('validatePackInstallPayload accepts valid payload', () => {
  const result = validatePackInstallPayload({ artifact_id: 'art_12345', workspace_id: 'ws_default' });
  assert.equal(result.ok, true);
});
