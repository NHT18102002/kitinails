const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectLogSearchRoots,
  detectPreviewProbeReason,
  getShopifyCliCommand,
  getShopifyCliExecutionOptions,
  inferStoreDomainFromLogText,
  summarizeConflictDiagnostics,
} = require('../src/conflicts.cjs');

test('collectLogSearchRoots includes repo root when tooling runs from nested cwd', () => {
  const roots = collectLogSearchRoots(
    'D:\\work\\shopify\\ersanails\\tools\\catalog-import',
    'D:\\work\\shopify\\ersanails'
  );

  assert.deepEqual(roots, [
    'D:\\work\\shopify\\ersanails\\tools\\catalog-import',
    'D:\\work\\shopify\\ersanails',
  ]);
});

test('inferStoreDomainFromLogText extracts myshopify domain from theme dev logs', () => {
  const storeDomain = inferStoreDomainFromLogText(`
    [2] https://kitinails.myshopify.com/?preview_theme_id=151269245079
    [3] https://kitinails.myshopify.com/admin/themes/151269245079/editor
  `);

  assert.equal(storeDomain, 'kitinails.myshopify.com');
});

test('detectPreviewProbeReason recognizes expired preview token responses', () => {
  assert.equal(
    detectPreviewProbeReason({
      status: 401,
      body: 'The access token provided is expired, revoked, malformed, or invalid for other reasons.',
    }),
    'preview_access_token_invalid'
  );
});

test('getShopifyCliCommand uses plain shopify command name across platforms', () => {
  assert.equal(getShopifyCliCommand('win32'), 'shopify');
  assert.equal(getShopifyCliCommand('linux'), 'shopify');
});

test('getShopifyCliExecutionOptions enables shell mode on Windows', () => {
  assert.deepEqual(getShopifyCliExecutionOptions('win32'), { shell: true });
  assert.deepEqual(getShopifyCliExecutionOptions('linux'), { shell: false });
});

test('summarizeConflictDiagnostics reports missing admin credentials with available store context', () => {
  const report = summarizeConflictDiagnostics({
    storeDomain: 'kitinails.myshopify.com',
    adminCredentialsPresent: false,
    previewProbe: { status: 401, reason: 'preview_access_token_invalid' },
    themeInfoProbe: { status: 'ok', themeId: '151269245079' },
    pendingHandles: ['seafoam', 'tropic-mood'],
  });

  assert.deepEqual(report, {
    status: 'skipped',
    reason: 'missing_admin_api_credentials',
    conflicts: [],
    pendingHandlesCount: 2,
    diagnostics: {
      storeDomain: 'kitinails.myshopify.com',
      previewProbe: { status: 401, reason: 'preview_access_token_invalid' },
      themeInfoProbe: { status: 'ok', themeId: '151269245079' },
    },
  });
});
