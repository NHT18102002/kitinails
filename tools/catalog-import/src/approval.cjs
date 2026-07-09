const path = require('node:path');

const { paths } = require('./config.cjs');
const { readJsonIfExists } = require('./fs-utils.cjs');

const approvalPath = path.join(paths.toolingRoot, 'config', 'import-approval.json');
const manifestHashPath = path.join(paths.manifestsRoot, 'normalized-manifest-hash.json');

function normalizeApproval(approval) {
  if (!approval || typeof approval !== 'object') {
    throw new Error('Import approval must be a JSON object.');
  }

  const normalized = {
    approvedFor: String(approval.approvedFor || '').trim(),
    approvedManifestSha256: String(approval.approvedManifestSha256 || '').trim(),
    draftOnly: approval.draftOnly === true,
    approvedAt: approval.approvedAt || '',
    notes: approval.notes || '',
  };

  if (normalized.approvedFor !== 'productset-import') {
    throw new Error('Import approval approvedFor must be productset-import.');
  }

  if (!normalized.approvedManifestSha256) {
    throw new Error('Import approval must include approvedManifestSha256.');
  }

  if (!normalized.draftOnly) {
    throw new Error('Import approval draftOnly must be true.');
  }

  return normalized;
}

function assertApprovedManifestHash({ currentHash, approval }) {
  const normalized = normalizeApproval(approval);
  const current = String(currentHash || '').trim();

  if (current !== normalized.approvedManifestSha256) {
    throw new Error(
      `Import approval hash mismatch. Current manifest ${current || '(missing)'} is not approved by ${normalized.approvedManifestSha256}.`
    );
  }

  return normalized;
}

async function readCurrentManifestHash() {
  const manifest = await readJsonIfExists(manifestHashPath);
  const hash = manifest?.normalizedManifestSha256 || manifest?.sha256 || '';

  if (!hash) {
    throw new Error(`Missing normalized manifest hash at ${manifestHashPath}. Run audit before import preflight.`);
  }

  return String(hash).trim();
}

async function readImportApproval() {
  const approval = await readJsonIfExists(approvalPath);

  if (!approval) {
    throw new Error(`Missing import approval at ${approvalPath}. Copy import-approval.example.json and approve the current manifest hash.`);
  }

  return normalizeApproval(approval);
}

async function assertCurrentManifestApproved() {
  const [currentHash, approval] = await Promise.all([readCurrentManifestHash(), readImportApproval()]);
  return assertApprovedManifestHash({ currentHash, approval });
}

module.exports = {
  approvalPath,
  assertApprovedManifestHash,
  assertCurrentManifestApproved,
  manifestHashPath,
  normalizeApproval,
  readCurrentManifestHash,
  readImportApproval,
};
