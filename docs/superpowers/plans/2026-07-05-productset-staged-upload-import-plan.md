# ProductSet Staged Upload Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the approved Ersa Nails catalog into Shopify as draft products using Admin GraphQL API `2026-07`, `productSet(identifier: { handle })`, staged asset upload, Shopify Files, and the approved audit manifest hash.

**Architecture:** Extend the existing `tools/catalog-import/` Node/CommonJS tooling only. The import phase remains outside the Shopify theme runtime, uses checkpointed local manifests for resume safety, and refuses to mutate Shopify unless `import-approval.json` matches the current normalized manifest hash. Assets are uploaded first through staged upload and Files API, files are polled until processed, and only then are products upserted with `productSet`.

**Tech Stack:** Node.js CommonJS, built-in `node:test`, Shopify Admin GraphQL API `2026-07`, `fetch`, local JSON/CSV manifests.

---

## Locked Inputs

- Approved normalized manifest hash: `5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68`
- Normalized manifest: `data/catalog/manifests/normalized-manifest.json`
- Asset manifest: `data/catalog/manifests/assets.json`
- Approved collection proposal source: `tools/catalog-import/config/collection-map.proposed.json`
- Product count: `591`
- Variant count: `2700`
- Asset count: `5076`
- All imported products must be `DRAFT`.
- API version must stay `2026-07`.
- No `productCreate` as the main import flow.
- No production publish.
- No secrets committed.

## File Impact Map

- Create `tools/catalog-import/config/import-approval.example.json`: documented approval format without secrets.
- Create `tools/catalog-import/config/import-approval.json`: local approval file, gitignored or left untracked if the repo policy prefers review-only approval files.
- Create `tools/catalog-import/config/collection-map.approved.json`: approved collection allowlist/map derived from the audited `include` list.
- Create `tools/catalog-import/src/approval.cjs`: manifest hash gate.
- Create `tools/catalog-import/src/shopify-admin.cjs`: Admin GraphQL client, environment validation, retries, and API version enforcement.
- Create `tools/catalog-import/src/shopify-queries.cjs`: GraphQL query/mutation strings.
- Create `tools/catalog-import/src/shopify-preflight.cjs`: scopes, locations, metafield definitions, collection IDs, and existing product conflict scan.
- Create `tools/catalog-import/src/asset-upload.cjs`: staged upload, multipart file upload, `fileCreate`, file polling, and asset upload manifest.
- Create `tools/catalog-import/src/productset-payload.cjs`: transform normalized product records into `ProductSetInput`.
- Create `tools/catalog-import/src/productset-import.cjs`: checkpointed product upsert runner using `productSet`.
- Create `tools/catalog-import/src/import-report.cjs`: final import report writers.
- Create `tools/catalog-import/src/run-import.cjs`: CLI entrypoint for dry run, asset upload, product import, and QA report.
- Modify `tools/catalog-import/package.json`: add import scripts only inside tooling.
- Add tests under `tools/catalog-import/test/*.test.cjs`.
- Add outputs under `data/catalog/manifests/` and `exports/`; do not write imported data into theme source.

## Task 1: Approval Gate And CLI Skeleton

**Files:**
- Create: `tools/catalog-import/config/import-approval.example.json`
- Create: `tools/catalog-import/config/collection-map.approved.json`
- Create: `tools/catalog-import/src/approval.cjs`
- Create: `tools/catalog-import/src/run-import.cjs`
- Create: `tools/catalog-import/test/approval.test.cjs`
- Modify: `tools/catalog-import/package.json`

- [ ] **Step 1: Write the failing approval tests**

Add `tools/catalog-import/test/approval.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertApprovedManifestHash,
  normalizeApproval,
} = require('../src/approval.cjs');

test('assertApprovedManifestHash accepts the approved audit hash', () => {
  assert.doesNotThrow(() =>
    assertApprovedManifestHash({
      currentHash: '5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68',
      approval: {
        approvedManifestSha256: '5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68',
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

test('normalizeApproval requires the productset import purpose', () => {
  assert.throws(
    () =>
      normalizeApproval({
        approvedManifestSha256: '5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68',
        draftOnly: true,
        approvedFor: 'audit-only',
      }),
    /approvedFor must be productset-import/i
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- approval.test.cjs
```

Expected: FAIL because `src/approval.cjs` does not exist.

- [ ] **Step 3: Implement the approval gate**

Create `tools/catalog-import/src/approval.cjs`:

```js
const fs = require('node:fs/promises');
const path = require('node:path');

const { paths } = require('./config.cjs');

function normalizeApproval(approval) {
  if (!approval || typeof approval !== 'object') {
    throw new Error('Import approval is missing');
  }

  if (approval.approvedFor !== 'productset-import') {
    throw new Error('approvedFor must be productset-import');
  }

  if (!approval.approvedManifestSha256) {
    throw new Error('approvedManifestSha256 is required');
  }

  if (approval.draftOnly !== true) {
    throw new Error('draftOnly must be true');
  }

  return approval;
}

function assertApprovedManifestHash({ currentHash, approval }) {
  const normalized = normalizeApproval(approval);

  if (normalized.approvedManifestSha256 !== currentHash) {
    throw new Error(
      `Import approval hash mismatch: expected ${currentHash}, got ${normalized.approvedManifestSha256}`
    );
  }

  return normalized;
}

async function readCurrentManifestHash() {
  const hashPath = path.join(paths.manifestsRoot, 'normalized-manifest-hash.json');
  const value = JSON.parse(await fs.readFile(hashPath, 'utf8'));
  return value.normalizedManifestSha256;
}

async function readImportApproval(filePath = path.join(paths.toolingRoot, 'config', 'import-approval.json')) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

module.exports = {
  assertApprovedManifestHash,
  normalizeApproval,
  readCurrentManifestHash,
  readImportApproval,
};
```

- [ ] **Step 4: Add approval example and approved collection map**

Create `tools/catalog-import/config/import-approval.example.json`:

```json
{
  "approvedFor": "productset-import",
  "approvedManifestSha256": "5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68",
  "draftOnly": true,
  "approvedCollectionMap": "tools/catalog-import/config/collection-map.approved.json",
  "approvedBy": "merchant",
  "approvedAt": "2026-07-05T00:00:00.000Z"
}
```

Create `tools/catalog-import/config/collection-map.approved.json` using only the audited `include` handles:

```json
{
  "generatedFromAuditHash": "5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68",
  "collections": [
    { "handle": "all", "action": "resolve_existing" },
    { "handle": "almond", "action": "resolve_existing" },
    { "handle": "best-seller", "action": "resolve_existing" },
    { "handle": "bridal", "action": "resolve_existing" },
    { "handle": "cat-eye", "action": "resolve_existing" },
    { "handle": "chrome", "action": "resolve_existing" },
    { "handle": "clearance", "action": "resolve_existing" },
    { "handle": "coffin", "action": "resolve_existing" },
    { "handle": "ersa-essence", "action": "resolve_existing" },
    { "handle": "ersa-nails-tools", "action": "resolve_existing" },
    { "handle": "ersas-accessories", "action": "resolve_existing" },
    { "handle": "flower-nails", "action": "resolve_existing" },
    { "handle": "french-tip", "action": "resolve_existing" },
    { "handle": "long", "action": "resolve_existing" },
    { "handle": "medium", "action": "resolve_existing" },
    { "handle": "mermaid", "action": "resolve_existing" },
    { "handle": "metallic", "action": "resolve_existing" },
    { "handle": "nails-under-30", "action": "resolve_existing" },
    { "handle": "new-arrival", "action": "resolve_existing" },
    { "handle": "ombre", "action": "resolve_existing" },
    { "handle": "oval", "action": "resolve_existing" },
    { "handle": "short", "action": "resolve_existing" },
    { "handle": "square", "action": "resolve_existing" },
    { "handle": "squoval", "action": "resolve_existing" }
  ]
}
```

- [ ] **Step 5: Add CLI skeleton**

Create `tools/catalog-import/src/run-import.cjs`:

```js
const {
  assertApprovedManifestHash,
  readCurrentManifestHash,
  readImportApproval,
} = require('./approval.cjs');

async function main() {
  const phase = readArgValue('--phase') || 'dry-run';
  const currentHash = await readCurrentManifestHash();
  const approval = await readImportApproval();
  assertApprovedManifestHash({ currentHash, approval });

  if (!['dry-run', 'preflight', 'upload-assets', 'import-products', 'qa'].includes(phase)) {
    throw new Error(`Unsupported import phase: ${phase}`);
  }

  process.stdout.write(
    JSON.stringify(
      {
        phase,
        apiVersion: '2026-07',
        approvedManifestSha256: currentHash,
        draftOnly: true,
      },
      null,
      2
    )
  );
  process.stdout.write('\n');
}

function readArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 6: Add scripts**

Modify `tools/catalog-import/package.json`:

```json
{
  "scripts": {
    "test": "node --test",
    "audit": "node src/run-pipeline.cjs --phase audit",
    "import:dry-run": "node src/run-import.cjs --phase dry-run",
    "import:preflight": "node src/run-import.cjs --phase preflight",
    "import:assets": "node src/run-import.cjs --phase upload-assets",
    "import:products": "node src/run-import.cjs --phase import-products",
    "import:qa": "node src/run-import.cjs --phase qa"
  }
}
```

- [ ] **Step 7: Verify**

Run:

```bash
cd tools/catalog-import
npm test
npm run import:dry-run
```

Expected:
- Tests pass.
- `import:dry-run` refuses to run until local `import-approval.json` exists.
- After creating local approval matching the example hash, `import:dry-run` prints `draftOnly: true` and does not call Shopify.

## Task 2: Admin GraphQL Client

**Files:**
- Create: `tools/catalog-import/src/shopify-admin.cjs`
- Create: `tools/catalog-import/test/shopify-admin.test.cjs`
- Modify: `tools/catalog-import/src/run-import.cjs`

- [ ] **Step 1: Write failing client tests**

Create `tools/catalog-import/test/shopify-admin.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildAdminGraphqlEndpoint,
  normalizeStoreDomain,
  requireAdminEnv,
} = require('../src/shopify-admin.cjs');

test('normalizeStoreDomain accepts a myshopify domain', () => {
  assert.equal(
    normalizeStoreDomain('https://develop-store-5y6bipog.myshopify.com/admin'),
    'develop-store-5y6bipog.myshopify.com'
  );
});

test('buildAdminGraphqlEndpoint pins API 2026-07', () => {
  assert.equal(
    buildAdminGraphqlEndpoint('develop-store-5y6bipog.myshopify.com'),
    'https://develop-store-5y6bipog.myshopify.com/admin/api/2026-07/graphql.json'
  );
});

test('requireAdminEnv rejects missing token', () => {
  assert.throws(
    () => requireAdminEnv({ SHOPIFY_STORE_DOMAIN: 'develop-store-5y6bipog.myshopify.com' }),
    /SHOPIFY_ADMIN_ACCESS_TOKEN/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- shopify-admin.test.cjs
```

Expected: FAIL because `shopify-admin.cjs` does not exist.

- [ ] **Step 3: Implement client**

Create `tools/catalog-import/src/shopify-admin.cjs`:

```js
const { constants } = require('./config.cjs');

function normalizeStoreDomain(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return parsed.hostname;
  } catch (error) {
    return raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  }
}

function buildAdminGraphqlEndpoint(storeDomain) {
  return `https://${normalizeStoreDomain(storeDomain)}/admin/api/${constants.apiVersion}/graphql.json`;
}

function requireAdminEnv(env = process.env) {
  const storeDomain = normalizeStoreDomain(env.SHOPIFY_STORE_DOMAIN);
  const accessToken = env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!storeDomain) throw new Error('SHOPIFY_STORE_DOMAIN is required');
  if (!accessToken) throw new Error('SHOPIFY_ADMIN_ACCESS_TOKEN is required');

  return { storeDomain, accessToken };
}

function createAdminClient(env = process.env) {
  const { storeDomain, accessToken } = requireAdminEnv(env);
  const endpoint = buildAdminGraphqlEndpoint(storeDomain);

  return async function graphql(query, variables = {}) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    const payload = await response.json();

    if (!response.ok || payload.errors?.length) {
      const message = payload.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`;
      throw new Error(`Shopify GraphQL request failed: ${message}`);
    }

    return payload.data;
  };
}

module.exports = {
  buildAdminGraphqlEndpoint,
  createAdminClient,
  normalizeStoreDomain,
  requireAdminEnv,
};
```

- [ ] **Step 4: Verify**

Run:

```bash
cd tools/catalog-import
npm test
```

Expected: all tests pass.

## Task 3: Shopify Preflight, Conflicts, Collections, And Metafield Definitions

**Files:**
- Create: `tools/catalog-import/src/shopify-queries.cjs`
- Create: `tools/catalog-import/src/shopify-preflight.cjs`
- Create: `tools/catalog-import/test/shopify-preflight.test.cjs`
- Modify: `tools/catalog-import/src/run-import.cjs`

- [ ] **Step 1: Write failing preflight tests**

Create `tools/catalog-import/test/shopify-preflight.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyExistingProduct,
  mapApprovedCollectionIds,
  requiredProductMetafieldDefinitions,
} = require('../src/shopify-preflight.cjs');

test('classifyExistingProduct allows update only when source_url matches', () => {
  assert.equal(
    classifyExistingProduct({
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: 'https://ersanails.com/products/seafoam',
      adoptExisting: false,
    }),
    'update'
  );
});

test('classifyExistingProduct skips existing product with blank source unless adopted', () => {
  assert.equal(
    classifyExistingProduct({
      sourceUrl: 'https://ersanails.com/products/seafoam',
      existingSourceUrl: '',
      adoptExisting: false,
    }),
    'skip_conflict'
  );
});

test('mapApprovedCollectionIds only returns resolved approved collections', () => {
  const result = mapApprovedCollectionIds({
    approvedCollections: [{ handle: 'all' }, { handle: 'almond' }],
    resolvedByHandle: new Map([['all', 'gid://shopify/Collection/1']]),
  });

  assert.deepEqual(result.collectionIds, ['gid://shopify/Collection/1']);
  assert.deepEqual(result.missingHandles, ['almond']);
});

test('requiredProductMetafieldDefinitions includes filter taxonomy fields', () => {
  const definitions = requiredProductMetafieldDefinitions();
  assert.equal(definitions.find((item) => item.key === 'source_url').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'nail_color').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'nail_shape').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'nail_length').namespace, 'custom');
  assert.equal(definitions.find((item) => item.key === 'finish_style').namespace, 'custom');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- shopify-preflight.test.cjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add GraphQL documents**

Create `tools/catalog-import/src/shopify-queries.cjs`:

```js
const QUERY_PRODUCTS_BY_HANDLE = `
  query ProductsByHandle($query: String!) {
    products(first: 10, query: $query) {
      nodes {
        id
        handle
        title
        metafield(namespace: "custom", key: "source_url") {
          value
        }
      }
    }
  }
`;

const QUERY_COLLECTIONS_BY_HANDLE = `
  query CollectionsByHandle($query: String!) {
    collections(first: 10, query: $query) {
      nodes {
        id
        handle
        title
      }
    }
  }
`;

const QUERY_LOCATIONS = `
  query Locations {
    locations(first: 10) {
      nodes {
        id
        name
        isActive
      }
    }
  }
`;

const QUERY_METAFIELD_DEFINITIONS = `
  query ProductMetafieldDefinitions($namespace: String!) {
    metafieldDefinitions(first: 250, ownerType: PRODUCT, namespace: $namespace) {
      nodes {
        id
        namespace
        key
        name
        type {
          name
        }
      }
    }
  }
`;

const MUTATION_METAFIELD_DEFINITION_CREATE = `
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        namespace
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

module.exports = {
  MUTATION_METAFIELD_DEFINITION_CREATE,
  QUERY_COLLECTIONS_BY_HANDLE,
  QUERY_LOCATIONS,
  QUERY_METAFIELD_DEFINITIONS,
  QUERY_PRODUCTS_BY_HANDLE,
};
```

- [ ] **Step 4: Implement preflight helpers**

Create `tools/catalog-import/src/shopify-preflight.cjs`:

```js
function classifyExistingProduct({ sourceUrl, existingSourceUrl, adoptExisting }) {
  if (!existingSourceUrl) return adoptExisting ? 'adopt' : 'skip_conflict';
  if (existingSourceUrl === sourceUrl) return 'update';
  return adoptExisting ? 'adopt' : 'skip_conflict';
}

function mapApprovedCollectionIds({ approvedCollections, resolvedByHandle }) {
  const collectionIds = [];
  const missingHandles = [];

  for (const collection of approvedCollections) {
    const id = resolvedByHandle.get(collection.handle);
    if (id) collectionIds.push(id);
    else missingHandles.push(collection.handle);
  }

  return { collectionIds, missingHandles };
}

function requiredProductMetafieldDefinitions() {
  return [
    { namespace: 'custom', key: 'source_url', name: 'Source URL', type: 'url' },
    { namespace: 'custom', key: 'source_product_id', name: 'Source Product ID', type: 'single_line_text_field' },
    { namespace: 'custom', key: 'demo_inventory', name: 'Demo Inventory', type: 'boolean' },
    { namespace: 'custom', key: 'nail_color', name: 'Nail color', type: 'single_line_text_field' },
    { namespace: 'custom', key: 'nail_shape', name: 'Nail shape', type: 'single_line_text_field' },
    { namespace: 'custom', key: 'nail_length', name: 'Nail length', type: 'single_line_text_field' },
    { namespace: 'custom', key: 'finish_style', name: 'Finish style', type: 'single_line_text_field' },
  ];
}

module.exports = {
  classifyExistingProduct,
  mapApprovedCollectionIds,
  requiredProductMetafieldDefinitions,
};
```

- [ ] **Step 5: Implement live preflight runner**

Add these live behaviors after helpers pass:

- Validate `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- Query active locations and choose the first active location unless `SHOPIFY_LOCATION_ID` is set.
- Query product metafield definitions in namespace `custom`.
- Create missing compatible definitions.
- Stop with report if an existing definition has an incompatible type.
- Resolve only handles in `collection-map.approved.json`.
- Do not create missing collections by default.
- Query existing products by handle in pages/batches.
- Write `data/catalog/manifests/import-preflight.json` with:
  - active location
  - resolved collections
  - missing approved collections
  - existing product decisions
  - skipped conflicts
  - metafield definition status

- [ ] **Step 6: Verify**

Run:

```bash
cd tools/catalog-import
npm test
npm run import:preflight
```

Expected:
- Unit tests pass.
- Without credentials, preflight fails with missing env message.
- With credentials, preflight writes `import-preflight.json`.
- No products are created or updated.

## Task 4: Staged Upload And Files API Asset Pipeline

**Files:**
- Create: `tools/catalog-import/src/asset-upload.cjs`
- Create: `tools/catalog-import/test/asset-upload.test.cjs`
- Modify: `tools/catalog-import/src/shopify-queries.cjs`
- Modify: `tools/catalog-import/src/run-import.cjs`

- [ ] **Step 1: Write failing asset upload tests**

Create `tools/catalog-import/test/asset-upload.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildStagedUploadInput,
  dedupeUploadAssets,
  mapReadyFileBySha,
} = require('../src/asset-upload.cjs');

test('dedupeUploadAssets uploads one file per sha256', () => {
  const assets = [
    { sha256: 'a', localPath: 'a.jpg', mediaType: 'IMAGE' },
    { sha256: 'a', localPath: 'a-copy.jpg', mediaType: 'IMAGE' },
    { sha256: 'b', localPath: 'b.jpg', mediaType: 'IMAGE' },
  ];

  assert.equal(dedupeUploadAssets(assets).length, 2);
});

test('buildStagedUploadInput maps image to PRODUCT_IMAGE', () => {
  assert.deepEqual(
    buildStagedUploadInput({
      localPath: 'D:\\work\\shopify\\ersanails\\data\\catalog\\assets\\seafoam\\01-seafoam-aabbccdd.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1234,
      mediaType: 'IMAGE',
    }),
    {
      filename: '01-seafoam-aabbccdd.jpg',
      mimeType: 'image/jpeg',
      httpMethod: 'POST',
      resource: 'PRODUCT_IMAGE',
    }
  );
});

test('mapReadyFileBySha keeps only READY files', () => {
  const result = mapReadyFileBySha([
    { sha256: 'a', shopifyFileId: 'gid://shopify/MediaImage/1', fileStatus: 'READY' },
    { sha256: 'b', shopifyFileId: 'gid://shopify/MediaImage/2', fileStatus: 'PROCESSING' },
  ]);

  assert.equal(result.get('a'), 'gid://shopify/MediaImage/1');
  assert.equal(result.has('b'), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- asset-upload.test.cjs
```

Expected: FAIL because `asset-upload.cjs` does not exist.

- [ ] **Step 3: Add upload mutations**

Add to `tools/catalog-import/src/shopify-queries.cjs`:

```js
const MUTATION_STAGED_UPLOADS_CREATE = `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const MUTATION_FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
        createdAt
        ... on MediaImage {
          image {
            url
          }
        }
        ... on Video {
          sources {
            url
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const QUERY_FILES_BY_IDS = `
  query FilesByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on File {
        id
        fileStatus
        alt
        ... on MediaImage {
          image {
            url
          }
        }
      }
    }
  }
`;
```

- [ ] **Step 4: Implement asset upload helpers**

Create `tools/catalog-import/src/asset-upload.cjs` with:

```js
const fs = require('node:fs/promises');
const path = require('node:path');

function dedupeUploadAssets(assets) {
  const bySha = new Map();

  for (const asset of assets) {
    if (!bySha.has(asset.sha256)) bySha.set(asset.sha256, asset);
  }

  return Array.from(bySha.values());
}

function buildStagedUploadInput(asset) {
  return {
    filename: path.basename(asset.localPath),
    mimeType: asset.mimeType || inferMimeType(asset.localPath),
    httpMethod: 'POST',
    resource: asset.mediaType === 'VIDEO' ? 'VIDEO' : 'PRODUCT_IMAGE',
    ...(asset.mediaType === 'VIDEO' ? { fileSize: String(asset.byteSize) } : {}),
  };
}

function mapReadyFileBySha(records) {
  const result = new Map();

  for (const record of records) {
    if (record.fileStatus === 'READY' && record.shopifyFileId) {
      result.set(record.sha256, record.shopifyFileId);
    }
  }

  return result;
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  return 'application/octet-stream';
}

async function readAssetByteSize(asset) {
  const stat = await fs.stat(asset.localPath);
  return stat.size;
}

module.exports = {
  buildStagedUploadInput,
  dedupeUploadAssets,
  inferMimeType,
  mapReadyFileBySha,
  readAssetByteSize,
};
```

- [ ] **Step 5: Implement live upload behavior**

Add live functions after unit tests:

- Read `data/catalog/manifests/assets.json`.
- Dedupe by `sha256`.
- Resume from `data/catalog/manifests/shopify-files.json`.
- For pending assets:
  - Build staged input.
  - Call `stagedUploadsCreate` in chunks.
  - Upload the file bytes to the returned `url` with returned form parameters.
  - Call `fileCreate` using the returned `resourceUrl` as `originalSource`.
  - Use `duplicateResolutionMode: "APPEND_UUID"`.
  - Store `shopifyFileId`, `fileStatus`, `resourceUrl`, `cdnUrl`, `sha256`, `localPath`.
  - Poll by IDs until `fileStatus === "READY"` or a timeout is reached.
- Write:
  - `data/catalog/manifests/shopify-files.json`
  - `data/catalog/manifests/shopify-files-failures.json`

- [ ] **Step 6: Verify**

Run:

```bash
cd tools/catalog-import
npm test
npm run import:assets
```

Expected:
- Unit tests pass.
- With credentials, unique assets are uploaded.
- Duplicate SHA assets reuse the same Shopify file ID.
- No product is created or updated in this phase.

## Task 5: ProductSet Payload Builder

**Files:**
- Create: `tools/catalog-import/src/productset-payload.cjs`
- Create: `tools/catalog-import/test/productset-payload.test.cjs`

- [ ] **Step 1: Write failing payload tests**

Create `tools/catalog-import/test/productset-payload.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDemoInventoryQuantity,
  buildProductSetInput,
  formatSingleLineTaxonomy,
} = require('../src/productset-payload.cjs');

test('buildDemoInventoryQuantity maps available products to 50', () => {
  assert.equal(buildDemoInventoryQuantity({ available: true }), 50);
});

test('buildDemoInventoryQuantity maps sold out products to 0', () => {
  assert.equal(buildDemoInventoryQuantity({ available: false }), 0);
});

test('formatSingleLineTaxonomy joins multi-value taxonomy for single line metafields', () => {
  assert.equal(formatSingleLineTaxonomy(['Pink', 'White']), 'Pink, White');
});

test('buildProductSetInput always creates draft products with source_url metafield', () => {
  const product = {
    title: 'Seafoam',
    handle: 'seafoam',
    descriptionHtml: '<p>Seafoam</p>',
    vendor: 'Ersa Nails',
    productType: 'Press On Nails',
    sourceUrl: 'https://ersanails.com/products/seafoam',
    sourceProductId: '123',
    tags: ['Color_Blue'],
    seo: { title: 'Seafoam', description: 'Seafoam nails' },
    taxonomy: { color: ['Blue'], shape: ['Almond'], length: ['Medium'], style: ['Chrome'] },
    options: [{ name: 'Size', values: ['XS'] }],
    variants: [{ id: 'v1', title: 'XS', price: '49.99', compareAtPrice: '', sku: '', available: true, options: ['XS'] }],
    media: [{ position: 1, sha256: 'sha-a', alt: 'Seafoam image' }],
  };

  const input = buildProductSetInput({
    product,
    collectionIds: ['gid://shopify/Collection/1'],
    fileIdBySha: new Map([['sha-a', 'gid://shopify/MediaImage/1']]),
    locationId: 'gid://shopify/Location/1',
  });

  assert.equal(input.status, 'DRAFT');
  assert.equal(input.handle, 'seafoam');
  assert.equal(input.collections[0], 'gid://shopify/Collection/1');
  assert.equal(input.metafields.find((item) => item.key === 'source_url').value, 'https://ersanails.com/products/seafoam');
  assert.equal(input.variants[0].inventoryQuantities[0].quantity, 50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- productset-payload.test.cjs
```

Expected: FAIL because payload module does not exist.

- [ ] **Step 3: Implement payload builder**

Create `tools/catalog-import/src/productset-payload.cjs`:

```js
function buildDemoInventoryQuantity(variant) {
  if (variant.available === false) return 0;
  return 50;
}

function formatSingleLineTaxonomy(values) {
  return (values || []).filter(Boolean).join(', ');
}

function buildProductSetInput({ product, collectionIds, fileIdBySha, locationId }) {
  const files = product.media
    .map((media) => ({
      id: fileIdBySha.get(media.sha256),
      alt: media.alt || `${product.title} image ${media.position}`,
    }))
    .filter((file) => file.id);

  return {
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml || '',
    vendor: product.vendor || 'Ersa Nails',
    productType: product.productType || '',
    status: 'DRAFT',
    tags: buildTags(product),
    seo: {
      title: product.seo?.title || product.title,
      description: product.seo?.description || '',
    },
    collections: collectionIds,
    files,
    metafields: buildProductMetafields(product),
    productOptions: buildProductOptions(product),
    variants: product.variants.map((variant, index) =>
      buildVariantInput({ product, variant, index, locationId, fileIdBySha })
    ),
  };
}

function buildProductMetafields(product) {
  return [
    { namespace: 'custom', key: 'source_url', type: 'url', value: product.sourceUrl },
    { namespace: 'custom', key: 'source_product_id', type: 'single_line_text_field', value: String(product.sourceProductId || '') },
    { namespace: 'custom', key: 'demo_inventory', type: 'boolean', value: 'true' },
    { namespace: 'custom', key: 'nail_color', type: 'single_line_text_field', value: formatSingleLineTaxonomy(product.taxonomy.color) },
    { namespace: 'custom', key: 'nail_shape', type: 'single_line_text_field', value: formatSingleLineTaxonomy(product.taxonomy.shape) },
    { namespace: 'custom', key: 'nail_length', type: 'single_line_text_field', value: formatSingleLineTaxonomy(product.taxonomy.length) },
    { namespace: 'custom', key: 'finish_style', type: 'single_line_text_field', value: formatSingleLineTaxonomy(product.taxonomy.style) },
  ].filter((item) => item.value !== undefined && item.value !== null && item.value !== '');
}

function buildProductOptions(product) {
  return (product.options || []).slice(0, 3).map((option, index) => ({
    name: option.name,
    position: index + 1,
    values: (option.values || []).map((name) => ({ name })),
  }));
}

function buildVariantInput({ product, variant, index, locationId, fileIdBySha }) {
  const media = product.media.find((item) => item.variantIds?.includes?.(variant.id)) || product.media[index];
  const fileId = media ? fileIdBySha.get(media.sha256) : null;

  return {
    position: index + 1,
    sku: variant.sku || '',
    price: String(variant.price || '0.00'),
    compareAtPrice: variant.compareAtPrice ? String(variant.compareAtPrice) : null,
    taxable: true,
    inventoryPolicy: 'DENY',
    inventoryQuantities: [
      {
        locationId,
        quantity: buildDemoInventoryQuantity(variant),
        name: 'available',
      },
    ],
    optionValues: buildVariantOptionValues(product, variant),
    ...(fileId ? { file: { id: fileId } } : {}),
  };
}

function buildVariantOptionValues(product, variant) {
  return (product.options || []).slice(0, 3).map((option, index) => ({
    optionName: option.name,
    name: variant.options?.[index] || option.values?.[0] || 'Default Title',
  }));
}

function buildTags(product) {
  const tags = new Set(product.tags || []);
  tags.add('demo-inventory');
  tags.add('source-ersanails');

  for (const color of product.taxonomy.color || []) tags.add(`Color_${color}`);
  for (const shape of product.taxonomy.shape || []) tags.add(`Shape_${shape}`);
  for (const length of product.taxonomy.length || []) tags.add(`Length_${length}`);
  for (const style of product.taxonomy.style || []) tags.add(`Style_${style}`);

  return Array.from(tags);
}

module.exports = {
  buildDemoInventoryQuantity,
  buildProductSetInput,
  formatSingleLineTaxonomy,
};
```

- [ ] **Step 4: Verify**

Run:

```bash
cd tools/catalog-import
npm test
```

Expected: all tests pass.

## Task 6: ProductSet Import Runner

**Files:**
- Create: `tools/catalog-import/src/productset-import.cjs`
- Create: `tools/catalog-import/test/productset-import.test.cjs`
- Modify: `tools/catalog-import/src/shopify-queries.cjs`
- Modify: `tools/catalog-import/src/run-import.cjs`

- [ ] **Step 1: Write failing import runner tests**

Create `tools/catalog-import/test/productset-import.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildProductSetVariables,
  shouldSkipProduct,
} = require('../src/productset-import.cjs');

test('buildProductSetVariables uses handle identifier and async mode', () => {
  const variables = buildProductSetVariables({
    handle: 'seafoam',
    input: { title: 'Seafoam', status: 'DRAFT' },
  });

  assert.deepEqual(variables, {
    identifier: { handle: 'seafoam' },
    input: { title: 'Seafoam', status: 'DRAFT' },
    synchronous: false,
  });
});

test('shouldSkipProduct skips conflicts by default', () => {
  assert.equal(shouldSkipProduct({ decision: 'skip_conflict' }), true);
  assert.equal(shouldSkipProduct({ decision: 'create' }), false);
  assert.equal(shouldSkipProduct({ decision: 'update' }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- productset-import.test.cjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add productSet mutation**

Add to `tools/catalog-import/src/shopify-queries.cjs`:

```js
const MUTATION_PRODUCT_SET = `
  mutation ProductSet($identifier: ProductSetIdentifiers, $input: ProductSetInput!, $synchronous: Boolean!) {
    productSet(identifier: $identifier, input: $input, synchronous: $synchronous) {
      product {
        id
        handle
        status
        variants(first: 250) {
          nodes {
            id
            sku
            inventoryItem {
              id
            }
          }
        }
      }
      productSetOperation {
        id
        status
        userErrors {
          code
          field
          message
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }
`;

const QUERY_PRODUCT_SET_OPERATION = `
  query ProductSetOperation($id: ID!) {
    productOperation(id: $id) {
      ... on ProductSetOperation {
        id
        status
        product {
          id
          handle
          status
        }
        userErrors {
          code
          field
          message
        }
      }
    }
  }
`;
```

- [ ] **Step 4: Implement runner helpers**

Create `tools/catalog-import/src/productset-import.cjs`:

```js
function buildProductSetVariables({ handle, input }) {
  return {
    identifier: { handle },
    input,
    synchronous: false,
  };
}

function shouldSkipProduct({ decision }) {
  return decision === 'skip_conflict';
}

module.exports = {
  buildProductSetVariables,
  shouldSkipProduct,
};
```

- [ ] **Step 5: Implement live runner**

Add live behavior:

- Read:
  - `normalized-manifest.json`
  - `shopify-files.json`
  - `import-preflight.json`
  - `collection-map.approved.json`
- Validate approval hash again.
- Build `fileIdBySha`.
- Build `collectionIds` from preflight.
- For each product:
  - Determine decision: `create`, `update`, `adopt`, or `skip_conflict`.
  - Skip conflicts unless `--adopt-existing` is present.
  - Build `ProductSetInput`.
  - Force `status: "DRAFT"` regardless of source.
  - Call `productSet(identifier: { handle }, input, synchronous: false)`.
  - Poll `productOperation` until success/failure.
  - Persist progress after every product.
- Write:
  - `data/catalog/manifests/productset-import-progress.json`
  - `data/catalog/manifests/productset-import-result.json`
  - `exports/productset-import-result.csv`

- [ ] **Step 6: Verify**

Run:

```bash
cd tools/catalog-import
npm test
npm run import:products
```

Expected:
- Products are created/updated as `DRAFT`.
- Existing products with missing/different `custom.source_url` are skipped and reported.
- The script can be stopped and resumed without duplicate creation because handle identifier is used.

## Task 7: Import QA Report

**Files:**
- Create: `tools/catalog-import/src/import-report.cjs`
- Create: `tools/catalog-import/test/import-report.test.cjs`
- Modify: `tools/catalog-import/src/run-import.cjs`

- [ ] **Step 1: Write failing QA tests**

Create `tools/catalog-import/test/import-report.test.cjs`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  summarizeImportResult,
} = require('../src/import-report.cjs');

test('summarizeImportResult counts created updated skipped failed products', () => {
  const summary = summarizeImportResult([
    { handle: 'a', status: 'created' },
    { handle: 'b', status: 'updated' },
    { handle: 'c', status: 'skipped_conflict' },
    { handle: 'd', status: 'failed' },
  ]);

  assert.deepEqual(summary, {
    created: 1,
    updated: 1,
    skippedConflict: 1,
    failed: 1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd tools/catalog-import
npm test -- import-report.test.cjs
```

Expected: FAIL because report module does not exist.

- [ ] **Step 3: Implement QA report helpers**

Create `tools/catalog-import/src/import-report.cjs`:

```js
function summarizeImportResult(rows) {
  return rows.reduce(
    (summary, row) => {
      if (row.status === 'created') summary.created += 1;
      if (row.status === 'updated') summary.updated += 1;
      if (row.status === 'skipped_conflict') summary.skippedConflict += 1;
      if (row.status === 'failed') summary.failed += 1;
      return summary;
    },
    { created: 0, updated: 0, skippedConflict: 0, failed: 0 }
  );
}

module.exports = {
  summarizeImportResult,
};
```

- [ ] **Step 4: Implement live QA**

Live QA should:

- Re-query imported product handles from Shopify.
- Confirm all imported products are `DRAFT`.
- Confirm imported count equals created + updated from result.
- Confirm skipped conflicts remain skipped.
- Confirm variant count per product matches manifest for imported rows.
- Confirm media count per product is nonzero when manifest had media.
- Confirm `custom.source_url`, taxonomy metafields, tags, and demo inventory metafield exist.
- Confirm approved collection IDs were attached where collection IDs were resolved.
- Write `docs/catalog-shopify-import-report.md`.

- [ ] **Step 5: Verify**

Run:

```bash
cd tools/catalog-import
npm test
npm run import:qa
```

Expected:
- QA report is written.
- Report clearly separates imported, skipped, and failed products.
- No production publish happens.

## Task 8: Final Verification And Theme Safety Check

**Files:**
- Modify: `docs/catalog-shopify-import-report.md`
- No theme runtime files should change.

- [ ] **Step 1: Run tooling tests**

Run:

```bash
cd tools/catalog-import
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run preflight, assets, products, QA in order**

Run:

```bash
cd tools/catalog-import
npm run import:preflight
npm run import:assets
npm run import:products
npm run import:qa
```

Expected:
- Preflight writes conflict and collection reports.
- Assets upload before products.
- Products import as draft.
- QA report verifies counts and blockers.

- [ ] **Step 3: Run theme check**

Run:

```bash
shopify theme check
```

Expected:
- No new theme errors from import tooling.
- If existing unrelated theme warnings exist, record them without changing theme files.

- [ ] **Step 4: Confirm no secrets**

Run:

```bash
rg -n "shpat_|SHOPIFY_ADMIN_ACCESS_TOKEN|X-Shopify-Access-Token|Bearer " .
```

Expected:
- No token values committed.
- Only source code references to env variable names or header names are allowed.

- [ ] **Step 5: Final report**

Final report must include:

- Approved manifest hash used.
- API version used.
- Products created.
- Products updated.
- Products skipped by conflict.
- Products failed.
- Variants created/updated.
- Assets uploaded.
- Duplicate assets reused.
- Files stuck in non-ready state.
- Collection IDs resolved/missing.
- Metafield definition status.
- Draft status verification.
- Remaining blockers.

## Implementation Notes From Shopify Docs

- `productSet` supports create/update in one request and is intended for syncing from external sources and large catalog management. It accepts `identifier`, `input`, and `synchronous`; asynchronous mode returns a product set operation that must be polled.
- `ProductSetIdentifiers` supports `handle`, which is the required safe upsert identifier for this project.
- `ProductSetInput` includes `collections`, `files`, `metafields`, `productOptions`, `status`, `tags`, `variants`, SEO, handle, vendor, and product type.
- `ProductVariantSetInput` includes `price`, `compareAtPrice`, `sku`, `optionValues`, `file`, and `inventoryQuantities`; use this for demo inventory on create.
- `stagedUploadsCreate` creates upload targets; upload local files to those targets, then use the returned `resourceUrl` in `fileCreate`.
- `fileCreate` processes files asynchronously and has a batch maximum of 250 files; poll `fileStatus` before attaching file IDs to products.
- `productCreateMedia` is deprecated in this API version; do not build the import flow around it.

## Non-Negotiable Safety Rules

- Never run without matching `import-approval.json`.
- Never import if normalized manifest hash differs from `5e68351a2a590c0020ffd2341a7c853b4ec146ea385f4351c1238bb1c9ebca68`.
- Never call `productCreate` as the main catalog import flow.
- Never publish products; imported products remain `DRAFT`.
- Never publish theme.
- Never write credentials to project files.
- Skip existing product conflicts by default.
- Only adopt existing products with explicit `--adopt-existing`.
- Only use approved collection map handles.
- Do not create hidden, locale, stale campaign, system, or review-pending collections by default.

## Open Inputs Required Before Execution

- Admin API access token with required scopes:
  - `write_products`
  - `read_products`
  - `write_files`
  - `read_files`
  - `write_inventory`
  - `read_inventory`
- Store domain in `SHOPIFY_STORE_DOMAIN`.
- Optional location override in `SHOPIFY_LOCATION_ID`; otherwise use first active location from preflight.
- Local `tools/catalog-import/config/import-approval.json` matching the approved hash.
