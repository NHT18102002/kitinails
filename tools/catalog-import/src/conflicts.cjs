const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { paths } = require('./config.cjs');

const execFileAsync = promisify(execFile);

async function scanExistingProductsConflicts(normalizedProducts) {
  const pendingHandles = normalizedProducts.map((product) => product.handle);
  const storeDomain = await inferStoreDomainFromLogs();
  const previewProbe = await probeLocalPreview();
  const themeInfoProbe = await probeThemeInfo(storeDomain);
  const adminCredentialsPresent = Boolean(
    process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
  );

  if (!adminCredentialsPresent) {
    return summarizeConflictDiagnostics({
      storeDomain,
      adminCredentialsPresent,
      previewProbe,
      themeInfoProbe,
      pendingHandles,
    });
  }

  return {
    status: 'skipped',
    reason: 'shopify_admin_graphql_conflict_scan_not_implemented_yet',
    conflicts: [],
    pendingHandlesCount: pendingHandles.length,
    diagnostics: {
      storeDomain,
      previewProbe,
      themeInfoProbe,
    },
  };
}

function summarizeConflictDiagnostics({
  storeDomain,
  adminCredentialsPresent,
  previewProbe,
  themeInfoProbe,
  pendingHandles,
}) {
  if (!adminCredentialsPresent) {
    return {
      status: 'skipped',
      reason: 'missing_admin_api_credentials',
      conflicts: [],
      pendingHandlesCount: pendingHandles.length,
      diagnostics: {
        storeDomain: storeDomain || '',
        previewProbe,
        themeInfoProbe,
      },
    };
  }

  return {
    status: 'skipped',
    reason: 'conflict_scan_unavailable',
    conflicts: [],
    pendingHandlesCount: pendingHandles.length,
    diagnostics: {
      storeDomain: storeDomain || '',
      previewProbe,
      themeInfoProbe,
    },
  };
}

async function inferStoreDomainFromLogs() {
  const fileNames = [
    '.codex-theme-dev.err.log',
    '.codex-theme-dev-9292.err.log',
    '.shopify-theme-dev.err.log',
    '.shopify-theme-dev-9294.err.log',
    '.shopify-theme-dev-9295.err.log',
    '_theme-dev.err.log',
  ];

  for (const rootPath of collectLogSearchRoots(process.cwd(), paths.repoRoot)) {
    for (const fileName of fileNames) {
      const filePath = path.join(rootPath, fileName);

      try {
        const content = await fs.readFile(filePath, 'utf8');
        const storeDomain = inferStoreDomainFromLogText(content);
        if (storeDomain) return storeDomain;
      } catch (error) {
        // Ignore missing logs and keep probing.
      }
    }
  }

  return '';
}

function collectLogSearchRoots(currentWorkingDirectory, repoRoot) {
  return Array.from(new Set([currentWorkingDirectory, repoRoot].filter(Boolean)));
}

function inferStoreDomainFromLogText(text) {
  const match = String(text || '').match(/https:\/\/([a-z0-9-]+\.myshopify\.com)\//i);
  return match ? match[1] : '';
}

async function probeLocalPreview() {
  const urls = [
    'http://127.0.0.1:9292/products.json?limit=5',
    'http://127.0.0.1:9292/',
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json,text/plain,*/*',
        },
      });
      const body = await response.text();
      return {
        status: response.status,
        reason: detectPreviewProbeReason({ status: response.status, body }),
      };
    } catch (error) {
      // Try the next preview probe.
    }
  }

  return {
    status: 0,
    reason: 'preview_unreachable',
  };
}

function detectPreviewProbeReason({ status, body }) {
  const text = String(body || '').toLowerCase();

  if (status === 401 && text.includes('access token provided is expired')) {
    return 'preview_access_token_invalid';
  }

  if (status === 401) return 'preview_unauthorized';
  if (status === 404) return 'preview_not_found';
  if (status >= 500) return 'preview_server_error';
  if (status === 200) return 'preview_ok';
  return 'preview_unknown';
}

async function probeThemeInfo(storeDomain) {
  if (!storeDomain) {
    return {
      status: 'missing_store_domain',
    };
  }

  try {
    const { stdout } = await execFileAsync(
      getShopifyCliCommand(process.platform),
      ['theme', 'info', '--store', storeDomain],
      {
        cwd: paths.repoRoot,
        ...getShopifyCliExecutionOptions(process.platform),
        timeout: 30000,
      }
    );
    const themeIdMatch = stdout.match(/Development Theme ID\s+#(\d+)/i);

    return {
      status: 'ok',
      themeId: themeIdMatch ? themeIdMatch[1] : '',
    };
  } catch (error) {
    return {
      status: 'error',
      reason: 'theme_info_probe_failed',
    };
  }
}

function getShopifyCliCommand(platform) {
  return 'shopify';
}

function getShopifyCliExecutionOptions(platform) {
  return {
    shell: platform === 'win32',
  };
}

module.exports = {
  collectLogSearchRoots,
  detectPreviewProbeReason,
  getShopifyCliCommand,
  getShopifyCliExecutionOptions,
  inferStoreDomainFromLogText,
  scanExistingProductsConflicts,
  summarizeConflictDiagnostics,
};
