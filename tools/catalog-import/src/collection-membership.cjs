const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const { fetchJson, fetchText } = require('./http.cjs');

function buildSourceCollectionTag(handle) {
  return `SrcCollection_${String(handle || '').trim()}`;
}

function extractSourceMembershipHandles(collectionRules) {
  const handles = new Set();

  for (const collection of collectionRules || []) {
    for (const rule of collection?.ruleSet?.rules || []) {
      if (String(rule.column || '') !== 'TAG') continue;
      if (String(rule.relation || '') !== 'EQUALS') continue;
      const condition = String(rule.condition || '');
      if (!condition.startsWith('SrcCollection_')) continue;
      handles.add(condition.slice('SrcCollection_'.length));
    }
  }

  return Array.from(handles).sort();
}

function parseCollectionProductHandlesFromHtml(html) {
  const handles = [];
  const seen = new Set();

  for (const match of String(html || '').matchAll(/href="\/products\/([^"?#/]+)(?:[^"]*)"/g)) {
    const handle = String(match[1] || '').trim();
    if (!handle || seen.has(handle)) continue;
    seen.add(handle);
    handles.push(handle);
  }

  return handles;
}

function deriveProductSourceTags({ normalizedProducts, productMemberships }) {
  const byHandle = new Map();
  const records = [];

  for (const product of normalizedProducts || []) {
    const memberships = Array.from(new Set(productMemberships.get(product.handle) || [])).sort();
    const sourceTags = memberships.map((handle) => buildSourceCollectionTag(handle));
    const mergedTags = mergeUniqueStrings([...(product.tags || []), ...sourceTags]);
    const record = {
      handle: product.handle,
      title: product.title || '',
      sourceCollections: memberships,
      sourceTags,
      mergedTags,
    };

    byHandle.set(product.handle, record);
    records.push(record);
  }

  return {
    generatedAt: new Date().toISOString(),
    byHandle,
    records,
  };
}

function buildCollectionPopulationForecast({
  approvedCollections,
  collectionRules,
  normalizedProducts,
  productSourceTagsByHandle,
}) {
  const rulesByHandle = new Map((collectionRules || []).map((collection) => [collection.handle, collection]));
  const records = [];
  const byHandle = new Map();
  const emptyApprovedCollections = [];

  for (const approved of approvedCollections || []) {
    const ruleConfig = rulesByHandle.get(approved.handle) || {
      handle: approved.handle,
      title: approved.title || '',
      strategy: 'missing_rule',
    };
    const matchingHandles = [];

    if (ruleConfig.strategy === 'auto_create_rule_backed' && ruleConfig.ruleSet) {
      for (const product of normalizedProducts || []) {
        const sourceTags = productSourceTagsByHandle.get(product.handle) || [];
        if (matchesRuleSet(product, ruleConfig.ruleSet, sourceTags)) {
          matchingHandles.push(product.handle);
        }
      }
    }

    const record = {
      handle: approved.handle,
      title: approved.title || ruleConfig.title || '',
      strategy: ruleConfig.strategy,
      forecastProductCount: matchingHandles.length,
      matchingHandles,
    };

    if (record.strategy === 'auto_create_rule_backed' && record.forecastProductCount === 0) {
      emptyApprovedCollections.push(record.handle);
    }

    records.push(record);
    byHandle.set(record.handle, record);
  }

  return {
    generatedAt: new Date().toISOString(),
    records,
    byHandle,
    emptyApprovedCollections,
  };
}

async function runCollectionMembership({ logger = () => {}, fetchJsonImpl = fetchJson, fetchTextImpl = fetchText } = {}) {
  const [normalized, approvedMap, collectionRuleMap, discovery] = await Promise.all([
    readJsonIfExists(path.join(paths.normalizedRoot, 'products.json')),
    readJsonIfExists(path.join(paths.toolingRoot, 'config', 'collection-map.approved.json')),
    readJsonIfExists(path.join(paths.toolingRoot, 'config', 'collection-rule-map.approved.json')),
    readJsonIfExists(path.join(paths.manifestsRoot, 'discovery.json')),
  ]);

  const normalizedProducts = Array.isArray(normalized) ? normalized : normalized?.products || [];
  const approvedCollections = approvedMap?.collections || approvedMap?.include || [];
  const collectionRules = collectionRuleMap?.collections || [];

  if (!normalizedProducts.length) {
    throw new Error(`Missing normalized products at ${path.join(paths.normalizedRoot, 'products.json')}. Run audit first.`);
  }

  const sourceCollectionHandles = extractSourceMembershipHandles(collectionRules);
  const discoveryCollectionsByHandle = new Map(
    (discovery?.collections || []).map((collection) => [collection.handle, collection])
  );
  const productMemberships = new Map();
  const collectionMembershipRecords = [];
  const missingSourceCollections = [];
  const unobservableSourceCollections = [];

  logger(`Resolving ${sourceCollectionHandles.length} source-membership collections...`);

  for (const handle of sourceCollectionHandles) {
    const collection = discoveryCollectionsByHandle.get(handle);

    if (!collection) {
      missingSourceCollections.push(handle);
      collectionMembershipRecords.push({
        handle,
        status: 'missing_from_discovery',
        productCount: 0,
        products: [],
      });
      continue;
    }

    const products = await fetchCollectionMembership({
      collection,
      fetchJsonImpl,
      fetchTextImpl,
    });

    if (Number(collection.products_count || 0) > 0 && products.length === 0) {
      unobservableSourceCollections.push(handle);
    }

    for (const productHandle of products) {
      const memberships = productMemberships.get(productHandle) || [];
      if (!memberships.includes(handle)) {
        memberships.push(handle);
      }
      productMemberships.set(productHandle, memberships);
    }

    collectionMembershipRecords.push({
      handle,
      title: collection.title || '',
      status: Number(collection.products_count || 0) > 0 && products.length === 0 ? 'unobservable_public_membership' : 'ready',
      publicProductsCount: Number(collection.products_count || 0),
      productCount: products.length,
      products,
    });
  }

  const sourceTags = deriveProductSourceTags({
    normalizedProducts,
    productMemberships,
  });
  const forecast = buildCollectionPopulationForecast({
    approvedCollections,
    collectionRules,
    normalizedProducts,
    productSourceTagsByHandle: new Map(
      sourceTags.records.map((record) => [record.handle, record.sourceTags])
    ),
  });

  const membershipManifest = {
    generatedAt: new Date().toISOString(),
    sourceCollectionHandles,
    missingSourceCollections,
    unobservableSourceCollections,
    collections: collectionMembershipRecords,
    productsWithSourceMembership: sourceTags.records.filter((record) => record.sourceCollections.length).length,
  };

  await writeJson(path.join(paths.manifestsRoot, 'source-collection-membership.json'), membershipManifest);
  await writeJson(path.join(paths.manifestsRoot, 'product-source-tags.json'), {
    generatedAt: sourceTags.generatedAt,
    records: sourceTags.records,
  });
  await writeJson(path.join(paths.manifestsRoot, 'collection-population-forecast.json'), {
    generatedAt: forecast.generatedAt,
    records: forecast.records,
    emptyApprovedCollections: forecast.emptyApprovedCollections,
  });

  return {
    ...membershipManifest,
    forecastEmptyApprovedCollections: forecast.emptyApprovedCollections,
  };
}

async function fetchCollectionMembership({ collection, fetchJsonImpl, fetchTextImpl }) {
  try {
    return await fetchCollectionMembershipFromJson({ collection, fetchJsonImpl });
  } catch (error) {
    return fetchCollectionMembershipFromHtml({ collection, fetchTextImpl });
  }
}

async function fetchCollectionMembershipFromJson({ collection, fetchJsonImpl }) {
  const handles = [];
  const seen = new Set();
  const totalPages = Math.max(1, Math.ceil(Number(collection.products_count || 0) / constants.pageSize));

  for (let page = 1; page <= totalPages; page += 1) {
    const response = await fetchJsonImpl(
      `${constants.baseUrl}/collections/${collection.handle}/products.json?limit=${constants.pageSize}&page=${page}`
    );
    const products = Array.isArray(response?.products) ? response.products : [];
    for (const product of products) {
      const handle = String(product.handle || '').trim();
      if (!handle || seen.has(handle)) continue;
      seen.add(handle);
      handles.push(handle);
    }

    if (products.length < constants.pageSize) break;
  }

  return handles;
}

async function fetchCollectionMembershipFromHtml({ collection, fetchTextImpl }) {
  const handles = [];
  const seen = new Set();
  const totalPages = Math.max(1, Math.ceil(Number(collection.products_count || 0) / constants.pageSize));

  for (let page = 1; page <= totalPages; page += 1) {
    const suffix = page > 1 ? `?page=${page}` : '';
    const html = await fetchTextImpl(`${constants.baseUrl}/collections/${collection.handle}${suffix}`, {
      cacheExtension: 'html',
    });
    const pageHandles = parseCollectionProductHandlesFromHtml(html);

    for (const handle of pageHandles) {
      if (seen.has(handle)) continue;
      seen.add(handle);
      handles.push(handle);
    }

    if (!pageHandles.length) break;
  }

  return handles;
}

function matchesRuleSet(product, ruleSet, sourceTags) {
  const predicates = (ruleSet?.rules || []).map((rule) => matchesRule(product, rule, sourceTags));
  if (!predicates.length) return false;
  return ruleSet.appliedDisjunctively ? predicates.some(Boolean) : predicates.every(Boolean);
}

function matchesRule(product, rule, sourceTags) {
  const column = String(rule?.column || '');
  const relation = String(rule?.relation || '');
  const condition = String(rule?.condition || '');

  if (column === 'TAG' && relation === 'EQUALS') {
    return new Set([...(product.tags || []), ...(sourceTags || [])]).has(condition);
  }

  if (column === 'TYPE' && relation === 'EQUALS') {
    return String(product.productType || '') === condition;
  }

  if (column === 'VARIANT_PRICE') {
    const numeric = Number(condition);
    return (product.variants || []).some((variant) => compareNumericRule(normalizeSourcePrice(variant.price), relation, numeric));
  }

  return false;
}

function compareNumericRule(value, relation, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return false;
  if (relation === 'LESS_THAN') return value < target;
  if (relation === 'GREATER_THAN') return value > target;
  if (relation === 'EQUALS') return value === target;
  if (relation === 'NOT_EQUALS') return value !== target;
  return false;
}

function mergeUniqueStrings(values) {
  const merged = [];
  const seen = new Set();

  for (const value of values || []) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function normalizeSourcePrice(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return NaN;
    if (trimmed.includes('.')) return Number(trimmed);
    return Number(trimmed) / 100;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return NaN;
    return Number.isInteger(value) ? value / 100 : value;
  }

  return NaN;
}

module.exports = {
  buildCollectionPopulationForecast,
  buildSourceCollectionTag,
  deriveProductSourceTags,
  extractSourceMembershipHandles,
  parseCollectionProductHandlesFromHtml,
  runCollectionMembership,
};
