import OpenAI, { toFile } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import type { CollectionSnapshot } from '@ersa/product-publisher-contracts';
import { sha256, stableStringify } from '@ersa/product-publisher-domain';

const MoneySchema = z.object({
  amount: z.number().positive().max(100_000),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
}).strict();

const MetafieldSchema = z.object({
  namespace: z.string().min(1).max(64),
  key: z.string().min(1).max(64),
  type: z.string().min(1).max(64),
  value: z.string().max(65_535),
}).strict();

const VariantSchema = z.object({
  skuSuffix: z.string().min(1).max(32),
  title: z.string().min(1).max(255),
  optionValues: z.record(z.string().min(1).max(255)),
  price: MoneySchema,
}).strict();

export const CatalogSpecSchema = z.object({
  schemaVersion: z.literal('catalog-spec-v1'),
  title: z.string().min(3).max(255),
  handle: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(255),
  descriptionHtml: z.string().min(40).max(20_000),
  vendor: z.string().min(1).max(255),
  productType: z.string().min(1).max(255),
  price: MoneySchema,
  tags: z.array(z.string().min(1).max(255)).min(1).max(50),
  seo: z.object({
    title: z.string().min(3).max(70),
    description: z.string().min(20).max(320),
  }).strict(),
  options: z.array(z.object({
    name: z.string().min(1).max(255),
    values: z.array(z.string().min(1).max(255)).min(1).max(100),
  }).strict()).min(1).max(3),
  variants: z.array(VariantSchema).min(1).max(100),
  metafields: z.array(MetafieldSchema).max(50),
  attributes: z.object({
    shape: z.string().min(1),
    length: z.string().min(1),
    finish: z.string().min(1),
    colors: z.array(z.string().min(1)).min(1).max(8),
    style: z.array(z.string().min(1)).min(1).max(8),
  }).strict(),
  confidence: z.object({
    identity: z.number().min(0).max(1),
    taxonomy: z.number().min(0).max(1),
    copy: z.number().min(0).max(1),
  }).strict(),
  evidence: z.array(z.string().min(1).max(500)).min(1).max(20),
  imageBriefs: z.array(z.object({
    role: z.enum(['HERO', 'DETAIL', 'LIFESTYLE', 'SCALE', 'PACKAGING']),
    prompt: z.string().min(20).max(2_000),
    alt: z.string().min(3).max(255),
  }).strict()).length(5),
}).strict();

export type CatalogSpec = z.infer<typeof CatalogSpecSchema>;

export interface AiSourceImage {
  data: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  canonicalHash: string;
}

export interface AnalyzeProductInput {
  images: readonly [AiSourceImage, AiSourceImage];
  collection: CollectionSnapshot;
  currencyCode: string;
  taxonomy: {
    shapes: readonly string[];
    lengths: readonly string[];
    finishes: readonly string[];
    styles: readonly string[];
  };
}

export interface AnalyzeProductResult {
  spec: CatalogSpec;
  provider: 'mock' | 'openai';
  model: string;
  providerRequestId: string | null;
  inputHash: string;
  promptHash: string;
}

export interface ProductAnalyzer {
  analyze(input: AnalyzeProductInput): Promise<AnalyzeProductResult>;
}

export class MockProductAnalyzer implements ProductAnalyzer {
  constructor(private readonly model = 'mock-catalog-v1') {}

  async analyze(input: AnalyzeProductInput): Promise<AnalyzeProductResult> {
    const inputHash = analysisInputHash(input);
    const shortId = inputHash.slice(0, 8);
    const shape = input.taxonomy.shapes[0] ?? 'Almond';
    const length = input.taxonomy.lengths[0] ?? 'Medium';
    const finish = input.taxonomy.finishes[0] ?? 'Glossy';
    const style = input.taxonomy.styles[0] ?? 'Minimal';
    const title = `Ersa ${shape} ${shortId}`;
    const spec = CatalogSpecSchema.parse({
      schemaVersion: 'catalog-spec-v1',
      title,
      handle: `ersa-${shape.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${shortId}`,
      descriptionHtml: `<p>A reusable press-on nail set analyzed from the supplied product references.</p><p>Shape: ${shape}. Length: ${length}. Finish: ${finish}.</p>`,
      vendor: 'Ersa Nails',
      productType: 'Press-On Nails',
      price: { amount: 19.99, currencyCode: input.currencyCode },
      tags: [shape, length, finish, style, input.collection.handle],
      seo: {
        title: `${title} | Ersa Nails`,
        description: `Shop the ${title} reusable press-on nail set with a ${finish.toLowerCase()} finish.`,
      },
      options: [{ name: 'Size', values: ['XS', 'S', 'M', 'L'] }],
      variants: ['XS', 'S', 'M', 'L'].map((size) => ({
        skuSuffix: size,
        title: size,
        optionValues: { Size: size },
        price: { amount: 19.99, currencyCode: input.currencyCode },
      })),
      metafields: [
        { namespace: 'custom', key: 'nail_shape', type: 'single_line_text_field', value: shape },
        { namespace: 'custom', key: 'nail_length', type: 'single_line_text_field', value: length },
      ],
      attributes: { shape, length, finish, colors: ['Pink'], style: [style] },
      confidence: { identity: 0.99, taxonomy: 0.9, copy: 0.9 },
      evidence: ['Deterministic mock output; no external AI request was made.'],
      imageBriefs: [
        ['HERO', 'Clean studio hero image on a neutral background with the exact nail design preserved.'],
        ['DETAIL', 'Macro detail view showing surface finish and nail artwork while preserving identity.'],
        ['LIFESTYLE', 'Lifestyle hand pose in soft daylight with the exact product design preserved.'],
        ['SCALE', 'Top-down scale and sizing view showing the complete press-on nail set accurately.'],
        ['PACKAGING', 'Premium Ersa Nails packaging composition with the exact nail set visible.'],
      ].map(([role, prompt]) => ({ role, prompt, alt: `${title} ${String(role).toLowerCase()} view` })),
    });
    return { spec, provider: 'mock', model: this.model, providerRequestId: null, inputHash, promptHash: 'mock-v1' };
  }
}

export class OpenAiProductAnalyzer implements ProductAnalyzer {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    client?: OpenAI,
  ) {
    if (!apiKey.trim() && !client) throw new Error('OPENAI_API_KEY is required in live mode');
    this.client = client ?? new OpenAI({ apiKey, timeout: 120_000, maxRetries: 4 });
  }

  async analyze(input: AnalyzeProductInput): Promise<AnalyzeProductResult> {
    const prompt = buildCatalogPrompt(input);
    const inputHash = analysisInputHash(input);
    const response = await this.client.responses.parse({
      model: this.model,
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: prompt },
          ...input.images.map((image) => ({
            type: 'input_image' as const,
            detail: 'high' as const,
            image_url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
          })),
        ],
      }],
      text: { format: zodTextFormat(CatalogSpecSchema, 'catalog_spec') },
    });
    if (!response.output_parsed) throw new Error('OpenAI response did not contain a parsed CatalogSpec');
    return {
      spec: CatalogSpecSchema.parse(response.output_parsed),
      provider: 'openai',
      model: this.model,
      providerRequestId: response.id,
      inputHash,
      promptHash: sha256(prompt),
    };
  }
}

export class OpenAiImageGenerator {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
    client?: OpenAI,
  ) {
    if (!apiKey.trim() && !client) throw new Error('OPENAI_API_KEY is required in live mode');
    this.client = client ?? new OpenAI({ apiKey, timeout: 180_000, maxRetries: 4 });
  }

  async generate(
    images: readonly [AiSourceImage, AiSourceImage],
    brief: CatalogSpec['imageBriefs'][number],
  ): Promise<{ data: Buffer; providerRequestId: string | null }> {
    const uploaded = await Promise.all(images.map((image, index) => (
      toFile(image.data, `source-${index + 1}.${extensionForMime(image.mimeType)}`, { type: image.mimeType })
    )));
    const response = await this.client.images.edit({
      model: this.model,
      image: uploaded,
      prompt: `${brief.prompt}\nPreserve the exact product identity, nail art, colors, shape and finish from both references. Do not add text, logos, hands with anatomical defects, or unrelated products.`,
      input_fidelity: 'high',
      quality: 'high',
      size: '1024x1024',
      output_format: 'webp',
      n: 1,
    });
    const encoded = response.data?.[0]?.b64_json;
    if (!encoded) throw new Error('OpenAI image response did not contain image data');
    return { data: Buffer.from(encoded, 'base64'), providerRequestId: null };
  }
}

function analysisInputHash(input: AnalyzeProductInput): string {
  return sha256(stableStringify({
    imageHashes: input.images.map((image) => image.canonicalHash).sort(),
    collection: input.collection,
    currencyCode: input.currencyCode,
    taxonomy: input.taxonomy,
    schemaVersion: 'catalog-spec-v1',
  }));
}

function buildCatalogPrompt(input: AnalyzeProductInput): string {
  return [
    'Analyze the same physical press-on nail product shown in both reference images.',
    'Return a conservative CatalogSpec. Never invent materials, certifications, included accessories, stock, reviews, discounts, urgency, or medical claims.',
    `Target collection: ${input.collection.title} (${input.collection.handle}).`,
    `Currency: ${input.currencyCode}.`,
    `Allowed shapes: ${input.taxonomy.shapes.join(', ')}.`,
    `Allowed lengths: ${input.taxonomy.lengths.join(', ')}.`,
    `Allowed finishes: ${input.taxonomy.finishes.join(', ')}.`,
    `Allowed styles: ${input.taxonomy.styles.join(', ')}.`,
    'Use only observable evidence. Lower confidence when uncertain. Produce exactly five distinct image briefs.',
    'Use safe semantic HTML limited to paragraphs and lists in descriptionHtml.',
  ].join('\n');
}

function extensionForMime(mimeType: AiSourceImage['mimeType']): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'webp';
}
