const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { ensureDir, pathExists, writeText } = require('./fs-utils.cjs');

const defaultHeaders = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  accept: 'application/json,text/plain,*/*',
  'accept-language': 'en-US,en;q=0.9',
};

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePathForUrl(url, extension) {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(paths.rawRoot, `${hash}.${extension}`);
}

async function fetchText(url, options = {}) {
  const { cacheExtension = 'txt', force = false } = options;
  const cachePath = cachePathForUrl(url, cacheExtension);

  if (!force && (await pathExists(cachePath))) {
    return fs.readFile(cachePath, 'utf8');
  }

  const text = await requestWithRetry(url);
  await ensureDir(paths.rawRoot);
  await writeText(cachePath, text);
  await sleep(constants.delayMs);
  return text;
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, { ...options, cacheExtension: options.cacheExtension || 'json' });
  return JSON.parse(text);
}

async function requestWithRetry(url) {
  let lastError = null;

  for (let attempt = 0; attempt < constants.maxRetries; attempt += 1) {
    try {
      const response = await fetch(url, { headers: defaultHeaders });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      const waitMs = constants.delayMs * Math.max(1, attempt + 1);
      await sleep(waitMs);
    }
  }

  throw lastError;
}

module.exports = {
  cachePathForUrl,
  defaultHeaders,
  fetchJson,
  fetchText,
  sleep,
};
