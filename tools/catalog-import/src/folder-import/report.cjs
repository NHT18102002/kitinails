const path = require('node:path');

const { writeJson, writeText } = require('../fs-utils.cjs');
const { sha256Text, stableStringify } = require('./manifest.cjs');
const { DEFAULT_OUTPUT_ROOT } = require('./scan.cjs');

function calculateDryRunHash(report) {
  const hashable = stripVolatileReportFields(report);
  return sha256Text(stableStringify(hashable));
}

function stripVolatileReportFields(value) {
  if (Array.isArray(value)) return value.map(stripVolatileReportFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['generatedAt', 'updatedAt', 'reportSha256'].includes(key))
      .map(([key, child]) => [key, stripVolatileReportFields(child)])
  );
}

function sealDryRunReport(report) {
  return {
    ...report,
    reportSha256: calculateDryRunHash(report),
  };
}

function csvCell(value) {
  const normalized = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
}

function buildDryRunCsv(report) {
  const columns = [
    'sourceKey',
    'decision',
    'reason',
    'title',
    'handle',
    'collectionFolder',
    'collectionGid',
    'existingProductGid',
    'existingStatus',
    'pairSha256',
    'requestHash',
    'primaryPath',
    'secondaryPath',
  ];
  const lines = [columns.join(',')];

  for (const item of report.items || []) {
    const row = {
      ...item,
      existingProductGid: item.existingProduct?.gid || '',
      existingStatus: item.existingProduct?.status || '',
      primaryPath: item.media?.find((media) => media.role === 'primary')?.path || '',
      secondaryPath: item.media?.find((media) => media.role === 'secondary')?.path || '',
    };
    lines.push(columns.map((column) => csvCell(row[column])).join(','));
  }

  return `${lines.join('\r\n')}\r\n`;
}

async function writeDryRunArtifacts({ report, outputRoot = DEFAULT_OUTPUT_ROOT }) {
  const jsonPath = path.join(outputRoot, 'dry-run.json');
  const csvPath = path.join(outputRoot, 'dry-run.csv');
  await Promise.all([writeJson(jsonPath, report), writeText(csvPath, buildDryRunCsv(report))]);
  return { jsonPath, csvPath };
}

module.exports = {
  buildDryRunCsv,
  calculateDryRunHash,
  csvCell,
  sealDryRunReport,
  stripVolatileReportFields,
  writeDryRunArtifacts,
};
