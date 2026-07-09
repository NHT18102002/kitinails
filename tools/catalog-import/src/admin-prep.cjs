const path = require('node:path');

const { constants, paths } = require('./config.cjs');
const { readJsonIfExists, writeJson } = require('./fs-utils.cjs');
const {
  MUTATION_COLLECTION_CREATE,
  MUTATION_METAFIELD_DEFINITION_CREATE,
  QUERY_IMPORT_PREFLIGHT,
} = require('./shopify-queries.cjs');

function requiredProductMetafieldDefinitions() {
  return [
    {
      namespace: 'custom',
      key: 'source_url',
      name: 'Source URL',
      type: 'url',
      purpose: 'import_identity',
    },
    {
      namespace: 'custom',
      key: 'source_product_id',
      name: 'Source Product ID',
      type: 'single_line_text_field',
      purpose: 'import_identity',
    },
    {
      namespace: 'custom',
      key: 'demo_inventory',
      name: 'Demo Inventory',
      type: 'boolean',
      purpose: 'demo_inventory_marker',
    },
    {
      namespace: 'custom',
      key: 'nail_shape',
      name: 'Nail shape',
      type: 'single_line_text_field',
      purpose: 'legacy_search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'nail_length',
      name: 'Nail length',
      type: 'single_line_text_field',
      purpose: 'legacy_search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'finish_style',
      name: 'Finish style',
      type: 'list.single_line_text_field',
      purpose: 'search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'nail_color_values',
      name: 'Nail color values',
      type: 'list.single_line_text_field',
      purpose: 'search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'nail_shape_values',
      name: 'Nail shape values',
      type: 'list.single_line_text_field',
      purpose: 'search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'nail_length_values',
      name: 'Nail length values',
      type: 'list.single_line_text_field',
      purpose: 'search_and_discovery_filter',
    },
    {
      namespace: 'custom',
      key: 'nail_style_values',
      name: 'Nail style values',
      type: 'list.single_line_text_field',
      purpose: 'search_and_discovery_filter',
    },
  ];
}

function normalizeConflictResolutionConfig(config) {
  const conflicts = Array.isArray(config?.conflicts) ? config.conflicts : [];
  const byHandle = new Map();

  for (const entry of conflicts) {
    const normalized = {
      handle: String(entry?.handle || '').trim(),
      existingProductId: String(entry?.existingProductId || '').trim(),
      sourceUrl: String(entry?.sourceUrl || '').trim(),
      action: String(entry?.action || '').trim(),
    };

    if (!normalized.handle || !normalized.existingProductId || !normalized.sourceUrl) {
      throw new Error('Every conflict resolution entry must include handle, existingProductId, and sourceUrl.');
    }

    if (normalized.action !== 'adopt_existing') {
      throw new Error(`Unsupported conflict resolution action for ${normalized.handle}: ${normalized.action}`);
    }

    byHandle.set(normalized.handle, normalized);
  }

  return {
    conflicts,
    byHandle,
  };
}

function canAdoptConflict({ handle, sourceUrl, existingProductId, conflictResolutionByHandle }) {
  const resolution = conflictResolutionByHandle?.get(String(handle || '').trim());
  if (!resolution) return false;

  return (
    resolution.action === 'adopt_existing' &&
    resolution.sourceUrl === String(sourceUrl || '').trim() &&
    resolution.existingProductId === String(existingProductId || '').trim()
  );
}

function normalizeCollectionRuleMap(config) {
  const collections = Array.isArray(config?.collections) ? config.collections : [];
  const byHandle = new Map();

  for (const collection of collections) {
    const normalized = {
      handle: String(collection?.handle || '').trim(),
      title: String(collection?.title || '').trim(),
      strategy: String(collection?.strategy || '').trim(),
      ruleSet: normalizeRuleSet(collection?.ruleSet || null),
    };

    if (!normalized.handle || !normalized.title) {
      throw new Error('Every collection rule entry must include handle and title.');
    }

    if (!['virtual_skip', 'auto_create_rule_backed', 'pending_merchant_rule'].includes(normalized.strategy)) {
      throw new Error(`Unsupported collection strategy for ${normalized.handle}: ${normalized.strategy}`);
    }

    if (normalized.strategy === 'auto_create_rule_backed' && !normalized.ruleSet) {
      throw new Error(`Collection ${normalized.handle} requires a ruleSet when strategy is auto_create_rule_backed.`);
    }

    if (normalized.strategy !== 'auto_create_rule_backed' && normalized.ruleSet) {
      throw new Error(`Collection ${normalized.handle} may only include ruleSet when strategy is auto_create_rule_backed.`);
    }

    byHandle.set(normalized.handle, normalized);
  }

  return {
    collections: Array.from(byHandle.values()),
    byHandle,
  };
}

function normalizeRuleSet(ruleSet) {
  if (!ruleSet) return null;

  const rules = Array.isArray(ruleSet.rules)
    ? ruleSet.rules.map((rule) => ({
        column: String(rule?.column || '').trim(),
        relation: String(rule?.relation || '').trim(),
        condition: String(rule?.condition || '').trim(),
      }))
    : [];

  if (!rules.length) {
    throw new Error('Collection ruleSet must include at least one rule.');
  }

  for (const rule of rules) {
    if (!rule.column || !rule.relation || !rule.condition) {
      throw new Error('Collection rules must include column, relation, and condition.');
    }
  }

  return {
    appliedDisjunctively: Boolean(ruleSet.appliedDisjunctively),
    rules,
  };
}

function buildCollectionCreateInput(collection, currencyCode = 'USD') {
  if (collection.strategy !== 'auto_create_rule_backed' || !collection.ruleSet) {
    throw new Error(`Collection ${collection.handle} is not rule-backed and cannot be created automatically.`);
  }

  return {
    handle: collection.handle,
    title: collection.title,
    sources: [
      {
        source: {
          title: collection.title,
          targetType: 'PRODUCTS',
          inclusion: buildCollectionInclusionInput(collection.ruleSet, currencyCode),
        },
      },
    ],
    ruleSet: collection.ruleSet,
  };
}

function buildCollectionPreparationPlan({ approvedCollections, resolvedByHandle, collectionRuleMapByHandle }) {
  const resolved = [];
  const virtualSkips = [];
  const pending = [];
  const toCreate = [];
  const missingRule = [];

  for (const collection of approvedCollections || []) {
    const handle = String(collection?.handle || '').trim();
    const resolvedId = resolvedByHandle.get(handle);
    const ruleEntry = collectionRuleMapByHandle.get(handle);

    if (resolvedId) {
      resolved.push({
        handle,
        id: resolvedId,
      });
      continue;
    }

    if (!ruleEntry) {
      missingRule.push({
        handle,
        title: collection.title || '',
      });
      continue;
    }

    if (ruleEntry.strategy === 'virtual_skip') {
      virtualSkips.push(ruleEntry);
      continue;
    }

    if (ruleEntry.strategy === 'pending_merchant_rule') {
      pending.push(ruleEntry);
      continue;
    }

    toCreate.push(ruleEntry);
  }

  return {
    resolved,
    virtualSkips,
    pending,
    toCreate,
    missingRule,
  };
}

function buildMetafieldDefinitionCreatePlan({ existingDefinitions }) {
  const existingByKey = new Map(
    (existingDefinitions || []).map((definition) => [
      `${definition.namespace}.${definition.key}`,
      {
        ...definition,
        existingType: definition?.type?.name || definition?.type || '',
      },
    ])
  );

  const required = requiredProductMetafieldDefinitions();
  const toCreate = [];
  const typeMismatches = [];
  const alreadyPresent = [];

  for (const definition of required) {
    const key = `${definition.namespace}.${definition.key}`;
    const existing = existingByKey.get(key);

    if (!existing) {
      toCreate.push(definition);
      continue;
    }

    if (existing.existingType !== definition.type) {
      typeMismatches.push({
        namespace: definition.namespace,
        key: definition.key,
        expectedType: definition.type,
        existingType: existing.existingType,
        existingDefinitionId: existing.id || '',
      });
      continue;
    }

    alreadyPresent.push({
      namespace: definition.namespace,
      key: definition.key,
      type: definition.type,
      existingDefinitionId: existing.id || '',
    });
  }

  return {
    required,
    toCreate,
    typeMismatches,
    alreadyPresent,
  };
}

async function readConflictResolutionConfig() {
  const config = await readJsonIfExists(path.join(paths.toolingRoot, 'config', 'conflict-resolution.approved.json'));
  if (!config) {
    throw new Error('Missing tools/catalog-import/config/conflict-resolution.approved.json');
  }
  return normalizeConflictResolutionConfig(config);
}

async function readCollectionRuleMap() {
  const config = await readJsonIfExists(path.join(paths.toolingRoot, 'config', 'collection-rule-map.approved.json'));
  if (!config) {
    throw new Error('Missing tools/catalog-import/config/collection-rule-map.approved.json');
  }
  return normalizeCollectionRuleMap(config);
}

async function readApprovedCollections() {
  const approved = await readJsonIfExists(path.join(paths.toolingRoot, 'config', 'collection-map.approved.json'));
  const collections = approved?.collections || approved?.include || [];

  if (!Array.isArray(collections)) {
    throw new Error('collection-map.approved.json must include a collections array.');
  }

  return collections.map((entry) => ({
    handle: String(entry?.handle || '').trim(),
    title: String(entry?.title || '').trim(),
  }));
}

async function runPrepareAdmin({ graphql, logger = () => {} }) {
  const [approvedCollections, conflictResolution, collectionRuleMap] = await Promise.all([
    readApprovedCollections(),
    readConflictResolutionConfig(),
    readCollectionRuleMap(),
  ]);

  const before = await graphql(QUERY_IMPORT_PREFLIGHT);
  const beforeDefinitions = before.metafieldDefinitions?.nodes || [];
  const beforeResolvedByHandle = await resolveCollectionIdsByHandle({ graphql, approvedCollections });
  const metafieldPlan = buildMetafieldDefinitionCreatePlan({
    existingDefinitions: beforeDefinitions,
  });
  const collectionPlan = buildCollectionPreparationPlan({
    approvedCollections,
    resolvedByHandle: beforeResolvedByHandle,
    collectionRuleMapByHandle: collectionRuleMap.byHandle,
  });

  logger(`Preparing ${metafieldPlan.toCreate.length} metafield definitions...`);
  const metafieldResults = [];
  for (const definition of metafieldPlan.toCreate) {
    const data = await graphql(MUTATION_METAFIELD_DEFINITION_CREATE, {
      definition: {
        namespace: definition.namespace,
        key: definition.key,
        name: definition.name,
        ownerType: 'PRODUCT',
        type: definition.type,
      },
    });
    const payload = data.metafieldDefinitionCreate;

    if (payload.userErrors?.length) {
      throw new Error(
        `metafieldDefinitionCreate failed for ${definition.namespace}.${definition.key}: ${payload.userErrors
          .map((error) => error.message)
          .join('; ')}`
      );
    }

    metafieldResults.push({
      namespace: definition.namespace,
      key: definition.key,
      id: payload.createdDefinition?.id || '',
    });
  }

  logger(`Preparing ${collectionPlan.toCreate.length} rule-backed collections...`);
  const collectionResults = [];
  for (const collection of collectionPlan.toCreate) {
    const collectionInput = buildCollectionCreateInput(collection, before.shop?.currencyCode || 'USD');
    const { ruleSet: unusedRuleSet, ...liveCollectionInput } = collectionInput;
    const data = await graphql(MUTATION_COLLECTION_CREATE, {
      collection: liveCollectionInput,
    });
    const payload = data.collectionCreate;

    if (payload.userErrors?.length) {
      throw new Error(
        `collectionCreate failed for ${collection.handle}: ${payload.userErrors
          .map((error) => error.message)
          .join('; ')}`
      );
    }

    collectionResults.push({
      handle: collection.handle,
      id: payload.collection?.id || '',
      title: payload.collection?.title || collection.title,
    });
  }

  const after = await graphql(QUERY_IMPORT_PREFLIGHT);
  const afterResolvedByHandle = await resolveCollectionIdsByHandle({ graphql, approvedCollections });
  const afterMetafieldPlan = buildMetafieldDefinitionCreatePlan({
    existingDefinitions: after.metafieldDefinitions?.nodes || [],
  });
  const afterCollectionPlan = buildCollectionPreparationPlan({
    approvedCollections,
    resolvedByHandle: afterResolvedByHandle,
    collectionRuleMapByHandle: collectionRuleMap.byHandle,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    apiVersion: constants.apiVersion,
    conflicts: {
      approvedAdopts: Array.from(conflictResolution.byHandle.values()),
    },
    metafields: {
      created: metafieldResults,
      alreadyPresent: metafieldPlan.alreadyPresent,
      missingAfterRun: afterMetafieldPlan.toCreate,
      typeMismatches: afterMetafieldPlan.typeMismatches,
    },
    collections: {
      created: collectionResults,
      resolvedAfterRun: Array.from(afterResolvedByHandle.entries()).map(([handle, id]) => ({ handle, id })),
      virtualSkips: afterCollectionPlan.virtualSkips,
      pending: afterCollectionPlan.pending,
      missingRule: afterCollectionPlan.missingRule,
      unresolvedRuleBacked: afterCollectionPlan.toCreate,
    },
  };

  await writeJson(path.join(paths.manifestsRoot, 'collection-prep-report.json'), report);
  return report;
}

function buildCollectionInclusionInput(ruleSet, currencyCode) {
  const tagRules = ruleSet.rules.filter((rule) => rule.column === 'TAG' && rule.relation === 'EQUALS');
  const typeRules = ruleSet.rules.filter((rule) => rule.column === 'TYPE' && rule.relation === 'EQUALS');
  const priceRules = ruleSet.rules.filter(
    (rule) => rule.column === 'VARIANT_PRICE' && ['LESS_THAN', 'GREATER_THAN', 'EQUALS', 'NOT_EQUALS'].includes(rule.relation)
  );
  const conditions = [];

  if (tagRules.length) {
    conditions.push({
      productTag: {
        relation: 'TAGGED_WITH',
        values: tagRules.map((rule) => rule.condition),
        matchType: ruleSet.appliedDisjunctively ? 'ANY' : 'ALL',
      },
    });
  }

  if (typeRules.length) {
    conditions.push({
      productType: {
        relation: typeRules[0].relation,
        values: typeRules.map((rule) => rule.condition),
        matchType: 'ANY',
      },
    });
  }

  for (const rule of priceRules) {
    conditions.push({
      variantPrice: {
        relation: rule.relation,
        value: {
          amount: String(rule.condition),
          currencyCode,
        },
      },
    });
  }

  if (!conditions.length) {
    throw new Error('Collection ruleSet could not be converted into Shopify collection source conditions.');
  }

  return {
    matchType: 'ANY',
    conditions,
  };
}

async function resolveCollectionIdsByHandle({ graphql, approvedCollections }) {
  const byHandle = new Map();

  for (const collection of approvedCollections) {
    const handle = String(collection.handle || '').trim();
    if (handle === 'all') continue;

    const data = await graphql(
      `#graphql
      query CollectionByHandle($query: String!) {
        collections(first: 10, query: $query) {
          nodes {
            id
            handle
          }
        }
      }`,
      { query: `handle:${handle}` }
    );
    const match = (data.collections?.nodes || []).find((item) => item.handle === handle);
    if (match) {
      byHandle.set(handle, match.id);
    }
  }

  return byHandle;
}

module.exports = {
  buildCollectionCreateInput,
  buildCollectionInclusionInput,
  buildCollectionPreparationPlan,
  buildMetafieldDefinitionCreatePlan,
  canAdoptConflict,
  normalizeCollectionRuleMap,
  normalizeConflictResolutionConfig,
  readApprovedCollections,
  readCollectionRuleMap,
  readConflictResolutionConfig,
  requiredProductMetafieldDefinitions,
  runPrepareAdmin,
};
