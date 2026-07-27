import type { CollectionSnapshot } from '@ersa/product-publisher-contracts';
import { sha256, stableStringify } from '@ersa/product-publisher-domain';

export class ShopifyAdminError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
    readonly requestId: string | null = null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ShopifyAdminError';
  }
}

export interface ShopifyAdminClientOptions {
  storeDomain: string;
  accessToken: string;
  apiVersion: string;
  maxAttempts?: number;
  fetchImpl?: typeof fetch;
  random?: () => number;
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string; extensions?: Record<string, unknown> }>;
  extensions?: Record<string, unknown>;
}

export interface ShopifyPreflight {
  shop: {
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    primaryDomain: { host: string };
  };
  scopes: string[];
  publications: Array<{
    id: string;
    name: string;
    autoPublish: boolean;
    supportsFuturePublishing: boolean;
  }>;
  externalIdDefinitionReady: boolean;
}

export interface ShopifyDraftPayload {
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: readonly string[];
  seo: { title: string; description: string };
  collectionGid: string;
  fileGids: readonly string[];
  options: ReadonlyArray<{ name: string; values: readonly string[] }>;
  variants: ReadonlyArray<{
    optionValues: Record<string, string>;
    price: number;
  }>;
  metafields: ReadonlyArray<{ namespace: string; key: string; type: string; value: string }>;
}

export interface ShopifyProductSnapshot {
  id: string;
  title: string;
  handle: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' | 'UNLISTED';
  updatedAt: string;
  publishedOnTarget: boolean;
  externalId: string | null;
  publisherId: string | null;
  payloadHash: string | null;
  media: Array<{ id: string; status: string; alt: string | null }>;
  snapshotHash: string;
}

export interface ShopifyImageFile {
  id: string;
  fileStatus: 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED';
  alt: string | null;
}

interface ShopifyCollectionPage {
  collections: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      ruleSet: null | {
        appliedDisjunctively: boolean;
        rules: Array<{ column: string; relation: string; condition: string }>;
      };
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

export class ShopifyAdminClient {
  readonly storeDomain: string;
  readonly apiVersion: string;
  readonly endpoint: string;
  private readonly accessToken: string;
  private readonly maxAttempts: number;
  private readonly fetchImpl: typeof fetch;
  private readonly random: () => number;

  constructor(options: ShopifyAdminClientOptions) {
    this.storeDomain = normalizeStoreDomain(options.storeDomain);
    this.apiVersion = options.apiVersion;
    this.accessToken = options.accessToken.trim();
    if (!this.accessToken) throw new ShopifyAdminError('SHOPIFY_TOKEN_MISSING', 'Shopify access token is required', false);
    this.maxAttempts = options.maxAttempts ?? 5;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.random = options.random ?? Math.random;
    this.endpoint = `https://${this.storeDomain}/admin/api/${this.apiVersion}/graphql.json`;
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': this.accessToken,
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(45_000),
        });
        const requestId = response.headers.get('x-request-id');
        const retryableHttp = response.status === 429 || response.status >= 500;
        if (!response.ok) {
          const safeMessage = `Shopify Admin GraphQL returned HTTP ${response.status}`;
          if (!retryableHttp || attempt === this.maxAttempts) {
            throw new ShopifyAdminError('SHOPIFY_HTTP_ERROR', safeMessage, retryableHttp, requestId, {
              status: response.status,
            });
          }
          await this.backoff(attempt, response.headers.get('retry-after'));
          continue;
        }

        const payload = await response.json() as GraphqlEnvelope<T>;
        if (payload.errors?.length) {
          throw new ShopifyAdminError(
            'SHOPIFY_GRAPHQL_ERROR',
            payload.errors.map((error) => error.message ?? 'Unknown GraphQL error').join('; '),
            false,
            requestId,
            { errors: payload.errors },
          );
        }
        if (!payload.data) {
          throw new ShopifyAdminError('SHOPIFY_EMPTY_RESPONSE', 'Shopify response did not contain data', false, requestId);
        }
        return payload.data;
      } catch (error) {
        lastError = error;
        if (error instanceof ShopifyAdminError && !error.retryable) throw error;
        if (attempt === this.maxAttempts) {
          if (error instanceof ShopifyAdminError) throw error;
          throw new ShopifyAdminError(
            'SHOPIFY_NETWORK_ERROR',
            error instanceof Error ? error.message : 'Shopify request failed',
            true,
          );
        }
        await this.backoff(attempt, null);
      }
    }
    throw lastError;
  }

  async preflight(): Promise<ShopifyPreflight> {
    const data = await this.graphql<{
      shop: ShopifyPreflight['shop'];
      appInstallation: { accessScopes: Array<{ handle: string }> };
      publications: { nodes: ShopifyPreflight['publications'] };
      metafieldDefinitions: { nodes: Array<{ key: string; type: { name: string } }> };
    }>(`#graphql
      query ProductPublisherPreflight {
        shop {
          name
          myshopifyDomain
          currencyCode
          primaryDomain { host }
        }
        appInstallation { accessScopes { handle } }
        publications(first: 50) {
          nodes { id name autoPublish supportsFuturePublishing }
        }
        metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "ersa_automation") {
          nodes { key type { name } }
        }
      }
    `);

    if (data.shop.myshopifyDomain.toLowerCase() !== this.storeDomain) {
      throw new ShopifyAdminError(
        'SHOPIFY_STORE_MISMATCH',
        'Authenticated Shopify token belongs to a different store',
        false,
      );
    }
    return {
      shop: data.shop,
      scopes: data.appInstallation.accessScopes.map((scope) => scope.handle),
      publications: data.publications.nodes,
      externalIdDefinitionReady: data.metafieldDefinitions.nodes.some(
        (definition) => definition.key === 'external_id' && definition.type.name.toLowerCase() === 'id',
      ),
    };
  }

  async bootstrapExternalIdDefinition(): Promise<{ created: boolean; definitionId: string | null }> {
    if ((await this.preflight()).externalIdDefinitionReady) return { created: false, definitionId: null };
    const data = await this.graphql<{
      metafieldDefinitionCreate: {
        createdDefinition: { id: string } | null;
        userErrors: ShopifyUserError[];
      };
    }>(`#graphql
      mutation ProductPublisherCreateExternalIdDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition { id }
          userErrors { field message code }
        }
      }
    `, {
      definition: {
        name: 'Product Publisher External ID',
        namespace: 'ersa_automation',
        key: 'external_id',
        description: 'Immutable idempotency key owned by the Ersa Product Publisher.',
        type: 'id',
        ownerType: 'PRODUCT',
      },
    });
    if (data.metafieldDefinitionCreate.userErrors.length) {
      if ((await this.preflight()).externalIdDefinitionReady) return { created: false, definitionId: null };
      assertNoUserErrors('metafieldDefinitionCreate', data.metafieldDefinitionCreate.userErrors);
    }
    const definitionId = data.metafieldDefinitionCreate.createdDefinition?.id ?? null;
    if (!definitionId || !(await this.preflight()).externalIdDefinitionReady) {
      throw new ShopifyAdminError('SHOPIFY_EXTERNAL_ID_BOOTSTRAP_FAILED', 'External ID definition was not created', false);
    }
    return { created: true, definitionId };
  }

  async findProductByExternalId(
    externalId: string,
    publicationGid?: string,
  ): Promise<ShopifyProductSnapshot | null> {
    const data = await this.graphql<{ productByIdentifier: null | ShopifyProductQueryResult }>(`#graphql
      query ProductPublisherProductByExternalId($identifier: ProductIdentifierInput!, $publicationId: ID!) {
        productByIdentifier(identifier: $identifier) {
          id
          title
          handle
          status
          updatedAt
          publishedOnPublication(publicationId: $publicationId)
          externalId: metafield(namespace: "ersa_automation", key: "external_id") { value }
          publisherId: metafield(namespace: "ersa_automation", key: "publisher_id") { value }
          payloadHash: metafield(namespace: "ersa_automation", key: "payload_hash") { value }
          media(first: 50) { nodes { id status alt } }
        }
      }
    `, {
      identifier: { customId: { namespace: 'ersa_automation', key: 'external_id', value: externalId } },
      publicationId: publicationGid ?? 'gid://shopify/Publication/0',
    });
    return data.productByIdentifier ? mapProductSnapshot(data.productByIdentifier) : null;
  }

  async findImageFileByContentHash(contentHash: string): Promise<ShopifyImageFile | null> {
    const filename = contentHashFilename(contentHash);
    const data = await this.graphql<{
      files: { nodes: ShopifyImageFile[] };
    }>(`#graphql
      query ProductPublisherFindFile($query: String!) {
        files(first: 10, query: $query) {
          nodes { id fileStatus alt }
        }
      }
    `, { query: `filename:${filename}` });
    return data.files.nodes[0] ?? null;
  }

  async ensureImageFile(input: {
    contentHash: string;
    data: Buffer;
    alt: string;
    pollIntervalMs?: number;
    timeoutMs?: number;
  }): Promise<ShopifyImageFile> {
    assertSha256(input.contentHash);
    const existing = await this.findImageFileByContentHash(input.contentHash);
    if (existing) return this.waitForFile(existing, input.pollIntervalMs, input.timeoutMs);

    const filename = contentHashFilename(input.contentHash);
    const staged = await this.graphql<{
      stagedUploadsCreate: {
        stagedTargets: Array<{
          url: string;
          resourceUrl: string;
          parameters: Array<{ name: string; value: string }>;
        }> | null;
        userErrors: ShopifyUserError[];
      };
    }>(`#graphql
      mutation ProductPublisherStageImage($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }
    `, {
      input: [{ filename, mimeType: 'image/webp', httpMethod: 'POST', resource: 'PRODUCT_IMAGE' }],
    });
    assertNoUserErrors('stagedUploadsCreate', staged.stagedUploadsCreate.userErrors);
    const target = staged.stagedUploadsCreate.stagedTargets?.[0];
    if (!target) throw new ShopifyAdminError('SHOPIFY_STAGED_TARGET_MISSING', 'Shopify returned no staged upload target', true);
    assertSafeStagedUploadUrl(target.url);

    const form = new FormData();
    for (const parameter of target.parameters) form.append(parameter.name, parameter.value);
    form.append('file', new Blob([new Uint8Array(input.data)], { type: 'image/webp' }), filename);
    const upload = await this.fetchImpl(target.url, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    if (!upload.ok) {
      throw new ShopifyAdminError(
        'SHOPIFY_STAGED_UPLOAD_FAILED',
        `Shopify staged upload returned HTTP ${upload.status}`,
        upload.status === 429 || upload.status >= 500,
      );
    }

    const created = await this.graphql<{
      fileCreate: { files: ShopifyImageFile[] | null; userErrors: ShopifyUserError[] };
    }>(`#graphql
      mutation ProductPublisherCreateImageFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files { id fileStatus alt }
          userErrors { field message code }
        }
      }
    `, {
      files: [{ alt: input.alt, contentType: 'IMAGE', originalSource: target.resourceUrl }],
    });
    if (created.fileCreate.userErrors.length) {
      const reconciled = await this.findImageFileByContentHash(input.contentHash);
      if (reconciled) return this.waitForFile(reconciled, input.pollIntervalMs, input.timeoutMs);
      assertNoUserErrors('fileCreate', created.fileCreate.userErrors);
    }
    const file = created.fileCreate.files?.[0];
    if (!file) throw new ShopifyAdminError('SHOPIFY_FILE_CREATE_EMPTY', 'fileCreate returned no file', true);
    return this.waitForFile(file, input.pollIntervalMs, input.timeoutMs);
  }

  async upsertDraftProduct(input: {
    externalId: string;
    publisherId: string;
    batchId: string;
    pipelineVersion: string;
    modelManifest: string;
    payload: ShopifyDraftPayload;
    expectedProductGid: string | null;
    publicationGid?: string;
  }): Promise<ShopifyProductSnapshot> {
    const existing = await this.findProductByExternalId(input.externalId, input.publicationGid);
    if (input.expectedProductGid && existing?.id !== input.expectedProductGid) {
      throw new ShopifyAdminError('SHOPIFY_TARGET_MISMATCH', 'Resolved product differs from authorized target', false);
    }
    if (!input.expectedProductGid && existing && existing.publisherId !== input.publisherId) {
      throw new ShopifyAdminError('SHOPIFY_FOREIGN_PRODUCT', 'Custom ID belongs to a product not owned by this publisher', false);
    }
    if (existing && existing.status !== 'DRAFT') {
      throw new ShopifyAdminError(
        'SHOPIFY_ACTIVE_UPDATE_BLOCKED',
        'This version only updates publisher-owned products that are already DRAFT',
        false,
      );
    }

    const payloadHash = sha256(stableStringify(input.payload));
    const automationMetafields = [
      { namespace: 'ersa_automation', key: 'external_id', type: 'id', value: input.externalId },
      { namespace: 'ersa_automation', key: 'publisher_id', type: 'single_line_text_field', value: input.publisherId },
      { namespace: 'ersa_automation', key: 'last_batch_id', type: 'single_line_text_field', value: input.batchId },
      { namespace: 'ersa_automation', key: 'payload_hash', type: 'single_line_text_field', value: payloadHash },
      { namespace: 'ersa_automation', key: 'pipeline_version', type: 'single_line_text_field', value: input.pipelineVersion },
      { namespace: 'ersa_automation', key: 'qa_state', type: 'single_line_text_field', value: 'DRAFT_PENDING_QA' },
      { namespace: 'ersa_automation', key: 'model_manifest', type: 'json', value: input.modelManifest },
    ];
    const productSetInput = {
      title: input.payload.title,
      handle: input.payload.handle,
      descriptionHtml: input.payload.descriptionHtml,
      vendor: input.payload.vendor,
      productType: input.payload.productType,
      status: 'DRAFT',
      tags: [...input.payload.tags],
      seo: input.payload.seo,
      collections: [input.payload.collectionGid],
      files: input.payload.fileGids.map((id) => ({ id })),
      productOptions: input.payload.options.map((option, position) => ({
        name: option.name,
        position: position + 1,
        values: option.values.map((name) => ({ name })),
      })),
      variants: input.payload.variants.map((variant) => ({
        optionValues: Object.entries(variant.optionValues).map(([optionName, name]) => ({ optionName, name })),
        price: variant.price,
      })),
      metafields: [...input.payload.metafields, ...automationMetafields],
    };
    const data = await this.graphql<{
      productSet: { product: ShopifyProductQueryResult | null; userErrors: ShopifyUserError[] };
    }>(`#graphql
      mutation ProductPublisherUpsertDraft(
        $identifier: ProductSetIdentifiers,
        $input: ProductSetInput!,
        $publicationId: ID!
      ) {
        productSet(identifier: $identifier, input: $input, synchronous: true) {
          product {
            id title handle status updatedAt
            publishedOnPublication(publicationId: $publicationId)
            externalId: metafield(namespace: "ersa_automation", key: "external_id") { value }
            publisherId: metafield(namespace: "ersa_automation", key: "publisher_id") { value }
            payloadHash: metafield(namespace: "ersa_automation", key: "payload_hash") { value }
            media(first: 50) { nodes { id status alt } }
          }
          userErrors { field message code }
        }
      }
    `, {
      identifier: { customId: { namespace: 'ersa_automation', key: 'external_id', value: input.externalId } },
      input: productSetInput,
      publicationId: input.publicationGid ?? 'gid://shopify/Publication/0',
    });
    assertNoUserErrors('productSet', data.productSet.userErrors);
    if (!data.productSet.product) {
      throw new ShopifyAdminError('SHOPIFY_PRODUCT_SET_EMPTY', 'productSet returned no product', true);
    }
    const snapshot = mapProductSnapshot(data.productSet.product);
    if (snapshot.status !== 'DRAFT') {
      throw new ShopifyAdminError('SHOPIFY_DRAFT_INVARIANT_FAILED', 'Product was not left in DRAFT status', false);
    }
    if (snapshot.externalId !== input.externalId || snapshot.publisherId !== input.publisherId) {
      throw new ShopifyAdminError('SHOPIFY_OWNERSHIP_WRITE_FAILED', 'Product ownership metafields were not persisted', false);
    }
    return snapshot;
  }

  async setProductStatus(productGid: string, status: 'DRAFT' | 'ACTIVE'): Promise<void> {
    const data = await this.graphql<{
      productUpdate: { product: { id: string; status: string } | null; userErrors: ShopifyUserError[] };
    }>(`#graphql
      mutation ProductPublisherSetStatus($product: ProductUpdateInput!) {
        productUpdate(product: $product) {
          product { id status }
          userErrors { field message }
        }
      }
    `, { product: { id: productGid, status } });
    assertNoUserErrors('productUpdate', data.productUpdate.userErrors);
    if (data.productUpdate.product?.status !== status) {
      throw new ShopifyAdminError('SHOPIFY_STATUS_UPDATE_FAILED', `Product did not reach ${status}`, true);
    }
  }

  async publish(productGid: string, publicationGid: string): Promise<void> {
    const data = await this.graphql<{
      publishablePublish: { publishable: { publishedOnPublication: boolean } | null; userErrors: ShopifyUserError[] };
    }>(`#graphql
      mutation ProductPublisherPublish($id: ID!, $input: [PublicationInput!]!, $publicationId: ID!) {
        publishablePublish(id: $id, input: $input) {
          publishable { publishedOnPublication(publicationId: $publicationId) }
          userErrors { field message }
        }
      }
    `, { id: productGid, input: [{ publicationId: publicationGid }], publicationId: publicationGid });
    assertNoUserErrors('publishablePublish', data.publishablePublish.userErrors);
    if (!data.publishablePublish.publishable?.publishedOnPublication) {
      throw new ShopifyAdminError('SHOPIFY_PUBLICATION_FAILED', 'Product is not published on target publication', true);
    }
  }

  async rollbackPublication(productGid: string, publicationGid: string): Promise<void> {
    const data = await this.graphql<{
      publishableUnpublish: { publishable: { publishedOnPublication: boolean } | null; userErrors: ShopifyUserError[] };
    }>(`#graphql
      mutation ProductPublisherUnpublish($id: ID!, $input: [PublicationInput!]!, $publicationId: ID!) {
        publishableUnpublish(id: $id, input: $input) {
          publishable { publishedOnPublication(publicationId: $publicationId) }
          userErrors { field message }
        }
      }
    `, { id: productGid, input: [{ publicationId: publicationGid }], publicationId: publicationGid });
    assertNoUserErrors('publishableUnpublish', data.publishableUnpublish.userErrors);
    if (data.publishableUnpublish.publishable?.publishedOnPublication) {
      throw new ShopifyAdminError('SHOPIFY_ROLLBACK_FAILED', 'Product remains published after rollback', true);
    }
    await this.setProductStatus(productGid, 'DRAFT');
  }

  async listCollections(): Promise<CollectionSnapshot[]> {
    const collections: CollectionSnapshot[] = [];
    let after: string | null = null;
    do {
      const data: ShopifyCollectionPage = await this.graphql<ShopifyCollectionPage>(`#graphql
        query ProductPublisherCollections($after: String) {
          collections(first: 100, after: $after, sortKey: TITLE) {
            nodes {
              id
              title
              handle
              ruleSet {
                appliedDisjunctively
                rules { column relation condition }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `, { after });

      for (const collection of data.collections.nodes) {
        const kind = collection.ruleSet?.rules.length ? 'AUTOMATED' : 'MANUAL';
        collections.push({
          gid: collection.id,
          title: collection.title,
          handle: collection.handle,
          rulesHash: sha256(stableStringify(collection.ruleSet ?? { manual: true })),
          kind,
          compatibility: kind === 'MANUAL' ? 'ASSIGNABLE' : 'UNSUPPORTED_RULE',
        });
      }
      after = data.collections.pageInfo.hasNextPage ? data.collections.pageInfo.endCursor : null;
    } while (after);
    return collections;
  }

  private async backoff(attempt: number, retryAfter: string | null): Promise<void> {
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1_000 : 0;
    const exponential = Math.min(30_000, 500 * 2 ** Math.max(0, attempt - 1));
    const delay = Number.isFinite(retryAfterMs) && retryAfterMs > 0
      ? retryAfterMs
      : Math.floor(this.random() * exponential);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async waitForFile(
    initial: ShopifyImageFile,
    pollIntervalMs = 1_000,
    timeoutMs = 120_000,
  ): Promise<ShopifyImageFile> {
    let file = initial;
    const deadline = Date.now() + timeoutMs;
    while (file.fileStatus !== 'READY') {
      if (file.fileStatus === 'FAILED') {
        throw new ShopifyAdminError('SHOPIFY_FILE_PROCESSING_FAILED', 'Shopify failed to process an image', false);
      }
      if (Date.now() >= deadline) {
        throw new ShopifyAdminError('SHOPIFY_FILE_PROCESSING_TIMEOUT', 'Timed out waiting for Shopify image processing', true);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(10, pollIntervalMs)));
      const data = await this.graphql<{ node: ShopifyImageFile | null }>(`#graphql
        query ProductPublisherFileStatus($id: ID!) {
          node(id: $id) { ... on MediaImage { id fileStatus alt } }
        }
      `, { id: file.id });
      if (!data.node) throw new ShopifyAdminError('SHOPIFY_FILE_DISAPPEARED', 'Shopify image no longer exists', false);
      file = data.node;
    }
    return file;
  }
}

export function normalizeStoreDomain(value: string): string {
  const raw = value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(raw)) {
    throw new ShopifyAdminError('SHOPIFY_STORE_DOMAIN_INVALID', 'Store domain must be a myshopify.com hostname', false);
  }
  return raw;
}

export function requiredScopes(writeMode: 'off' | 'draft' | 'publish'): string[] {
  const scopes = ['read_products', 'read_files', 'read_publications'];
  if (writeMode !== 'off') scopes.push('write_products', 'write_files');
  if (writeMode === 'publish') scopes.push('write_publications');
  return scopes;
}

export function missingScopes(granted: readonly string[], required: readonly string[]): string[] {
  const grantedSet = new Set(granted);
  return required.filter((scope) => !grantedSet.has(scope));
}

interface ShopifyUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

interface ShopifyProductQueryResult {
  id: string;
  title: string;
  handle: string;
  status: ShopifyProductSnapshot['status'];
  updatedAt: string;
  publishedOnPublication: boolean;
  externalId: { value: string } | null;
  publisherId: { value: string } | null;
  payloadHash: { value: string } | null;
  media: { nodes: Array<{ id: string; status: string; alt: string | null }> };
}

function mapProductSnapshot(product: ShopifyProductQueryResult): ShopifyProductSnapshot {
  const canonical = {
    id: product.id,
    title: product.title,
    handle: product.handle,
    status: product.status,
    updatedAt: product.updatedAt,
    publishedOnTarget: product.publishedOnPublication,
    externalId: product.externalId?.value ?? null,
    publisherId: product.publisherId?.value ?? null,
    payloadHash: product.payloadHash?.value ?? null,
    media: product.media.nodes,
  };
  return { ...canonical, snapshotHash: sha256(stableStringify(canonical)) };
}

function assertNoUserErrors(operation: string, errors: readonly ShopifyUserError[]): void {
  if (!errors.length) return;
  throw new ShopifyAdminError(
    'SHOPIFY_USER_ERROR',
    `${operation}: ${errors.map((error) => error.message).join('; ')}`,
    false,
    null,
    { errors },
  );
}

function contentHashFilename(contentHash: string): string {
  assertSha256(contentHash);
  return `ersa-pp-${contentHash}.webp`;
}

function assertSha256(value: string): void {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new ShopifyAdminError('CONTENT_HASH_INVALID', 'Content hash must be lowercase SHA-256', false);
  }
}

function assertSafeStagedUploadUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ShopifyAdminError('SHOPIFY_STAGED_URL_INVALID', 'Shopify returned an invalid staged upload URL', false);
  }
  const hostname = url.hostname.toLowerCase();
  const isIpAddress = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
  if (url.protocol !== 'https:' || hostname === 'localhost' || hostname.endsWith('.localhost') || isIpAddress) {
    throw new ShopifyAdminError('SHOPIFY_STAGED_URL_UNSAFE', 'Shopify returned an unsafe staged upload URL', false);
  }
}
