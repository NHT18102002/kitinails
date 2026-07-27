const crypto = require('node:crypto');

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function calculateManifestHash(manifest) {
  const hashable = { ...manifest };
  delete hashable.generatedAt;
  delete hashable.manifestSha256;
  return sha256Text(stableStringify(hashable));
}

function sealManifest(manifest) {
  return {
    ...manifest,
    manifestSha256: calculateManifestHash(manifest),
  };
}

module.exports = {
  calculateManifestHash,
  canonicalize,
  sealManifest,
  sha256Text,
  stableStringify,
};
