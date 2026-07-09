const { constants } = require('./config.cjs');
const { fetchJson, fetchText } = require('./http.cjs');

async function crawlCatalog(discoveryManifest) {
  const collectionMemberships = new Map();
  const products = [];
  const failures = [];

  for (const product of discoveryManifest.products) {
    try {
      const [productJs, productHtml] = await Promise.all([
        fetchJson(`${constants.baseUrl}/products/${product.handle}.js`),
        fetchText(`${constants.baseUrl}/products/${product.handle}`, { cacheExtension: 'html' }),
      ]);

      products.push({
        handle: product.handle,
        productJs,
        productHtml,
        collections: collectionMemberships.get(product.handle) || [],
      });
    } catch (error) {
      failures.push({
        handle: product.handle,
        sourceUrl: product.url,
        error: error.message,
      });
    }
  }

  return {
    crawledAt: new Date().toISOString(),
    products,
    failures,
  };
}

async function buildCollectionMemberships(collections) {
  const memberships = new Map();

  for (const collection of collections) {
    if (collection.decision === 'exclude') continue;

    const totalPages = Math.max(1, Math.ceil((collection.products_count || 0) / constants.pageSize));

    for (let page = 1; page <= totalPages; page += 1) {
      const response = await fetchJson(
        `${constants.baseUrl}/collections/${collection.handle}/products.json?limit=${constants.pageSize}&page=${page}`
      );

      for (const product of response.products || []) {
        const existing = memberships.get(product.handle) || [];
        if (!existing.includes(collection.handle)) existing.push(collection.handle);
        memberships.set(product.handle, existing);
      }
    }
  }

  return memberships;
}

module.exports = {
  buildCollectionMemberships,
  crawlCatalog,
};
