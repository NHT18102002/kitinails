const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertApprovedManifestHash,
  normalizeApproval,
} = require('../src/approval.cjs');

const APPROVED_HASH = '5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68';

test('assertApprovedManifestHash accepts the approved audit hash', () => {
  assert.doesNotThrow(() =>
    assertApprovedManifestHash({
      currentHash: APPROVED_HASH,
      approval: {
        approvedManifestSha256: APPROVED_HASH,
        approvedFor: 'productset-import',
        draftOnly: true,
      },
    })
  );
});

test('assertApprovedManifestHash rejects stale approval hash', () => {
  assert.throws(
    () =>
      assertApprovedManifestHash({
        currentHash: 'fresh',
        approval: {
          approvedManifestSha256: 'stale',
          approvedFor: 'productset-import',
          draftOnly: true,
        },
      }),
    /approval hash mismatch/i
  );
});

test('normalizeApproval requires productset import purpose and draft-only mode', () => {
  assert.throws(
    () =>
      normalizeApproval({
        approvedManifestSha256: APPROVED_HASH,
        draftOnly: true,
        approvedFor: 'audit-only',
      }),
    /approvedFor must be productset-import/i
  );

  assert.throws(
    () =>
      normalizeApproval({
        approvedManifestSha256: APPROVED_HASH,
        approvedFor: 'productset-import',
      }),
    /draftOnly must be true/i
  );
});
