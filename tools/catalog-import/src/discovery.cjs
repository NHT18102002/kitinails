const { constants } = require('./config.cjs');
const { fetchJson, fetchText } = require('./http.cjs');

function canonicalizeProductUrl(url) {
  if (!url) return null;
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, '');

  if (pathname.startsWith('/de/')) return null;
  if (!pathname.startsWith('/products/')) return null;

  return `https://ersanails.com${pathname}`;
}

function dedupeProducts(records) {
  const seen = new Map();
  const duplicates = [];

  for (const record of records) {
    if (!record?.handle) continue;
    const canonicalUrl = canonicalizeProductUrl(record.url);

    if (!canonicalUrl) continue;

    if (seen.has(record.handle)) {
      duplicates.push({
        handle: record.handle,
        kept: seen.get(record.handle),
        skipped: { ...record, url: canonicalUrl },
      });
      continue;
    }

    seen.set(record.handle, { ...record, url: canonicalUrl });
  }

  return {
    products: Array.from(seen.values()),
    duplicates,
  };
}

function proposeCollectionDecision(collection) {
  const handle = String(collection?.handle || '').toLowerCase();
  const coreStorefrontCollections = new Set([
    'all',
    'best-seller',
    'new-arrival',
    'clearance',
    'bridal',
    'nails-under-30',
    'almond',
    'coffin',
    'oval',
    'square',
    'squoval',
    'short',
    'medium',
    'long',
    'cat-eye',
    'chrome',
    'french-tip',
    'flower-nails',
    'metallic',
    'mermaid',
    'ombre',
    'ersa-essence',
    'ersa-nails-tools',
    'ersas-accessories',
  ]);

  if (
    handle.endsWith('-copy') ||
    handle.includes('-copy-') ||
    handle.includes('copy') ||
    handle.includes('副本')
  ) {
    return { decision: 'exclude', reason: 'copy_handle' };
  }

  if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\d{2}\b/.test(handle)) {
    return { decision: 'exclude', reason: 'dated_campaign_handle' };
  }

  if (
    handle.includes('flash-sale') ||
    handle.includes('flashsale') ||
    handle.includes('giveaway') ||
    handle.includes('winner') ||
    handle.includes('cyber-week') ||
    handle.includes('black-friday') ||
    handle.includes('_ads') ||
    handle.endsWith('-ads') ||
    handle.startsWith('except-') ||
    handle.includes('collab-gift')
  ) {
    return { decision: 'exclude', reason: 'campaign_collection' };
  }

  if (coreStorefrontCollections.has(handle)) {
    return { decision: 'include', reason: 'core_storefront_collection' };
  }

  return { decision: 'review', reason: 'needs_allowlist_review' };
}

async function discoverCatalog() {
  const [sitemapXml, collections] = await Promise.all([
    fetchText(`${constants.baseUrl}/sitemap.xml`, { cacheExtension: 'xml' }),
    fetchAllCollections(),
  ]);

  const sitemapProductUrls = await discoverProductUrlsFromSitemaps(sitemapXml);
  const productJsonUrls = await discoverProductUrlsFromProductsJson();
  const deduped = dedupeProducts([...sitemapProductUrls, ...productJsonUrls]);
  const proposedCollections = collections.map((collection) => ({
    ...collection,
    ...proposeCollectionDecision(collection),
    url: `${constants.baseUrl}/collections/${collection.handle}`,
  }));

  return {
    discoveredAt: new Date().toISOString(),
    products: deduped.products,
    duplicates: deduped.duplicates,
    collections: proposedCollections,
    sources: {
      sitemapProductUrlCount: sitemapProductUrls.length,
      productJsonUrlCount: productJsonUrls.length,
      collectionCount: collections.length,
    },
  };
}

async function discoverProductUrlsFromSitemaps(rootSitemapXml) {
  const sitemapUrls = [...rootSitemapXml.matchAll(/<loc>([^<]+sitemap_products[^<]+)<\/loc>/g)].map((match) =>
    decodeXmlEntities(match[1])
  );

  const records = [];

  for (const sitemapUrl of sitemapUrls) {
    const xml = await fetchText(sitemapUrl, { cacheExtension: 'xml' });
    const productUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => decodeXmlEntities(match[1]))
      .filter((url) => canonicalizeProductUrl(url));

    for (const url of productUrls) {
      records.push({
        handle: url.split('/products/')[1].replace(/\/+$/, ''),
        source: 'sitemap',
        url,
      });
    }
  }

  return records;
}

async function discoverProductUrlsFromProductsJson() {
  const records = [];

  for (let page = 1; ; page += 1) {
    const url = `${constants.baseUrl}/products.json?limit=${constants.pageSize}&page=${page}`;
    const response = await fetchJson(url);
    const products = response.products || [];

    if (!products.length) break;

    for (const product of products) {
      records.push({
        handle: product.handle,
        source: 'products-json',
        url: `${constants.baseUrl}/products/${product.handle}`,
      });
    }
  }

  return records;
}

async function fetchAllCollections() {
  const collections = [];

  for (let page = 1; ; page += 1) {
    const url = `${constants.baseUrl}/collections.json?limit=${constants.pageSize}&page=${page}`;
    const response = await fetchJson(url);
    const pageCollections = response.collections || [];

    if (!pageCollections.length) break;
    collections.push(...pageCollections);
  }

  return collections;
}

function decodeXmlEntities(value) {
  return value.replace(/&amp;/g, '&');
}

module.exports = {
  canonicalizeProductUrl,
  dedupeProducts,
  discoverCatalog,
  proposeCollectionDecision,
};
