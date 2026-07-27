import { z } from 'zod';

const ConfigSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4310),
    APP_ACCESS_TOKEN: z.string().default(''),
    CORS_ORIGINS: z.string().default('http://127.0.0.1:4311,http://localhost:4311'),
    DATABASE_URL: z.string().min(1),
    DATABASE_SSL: z.enum(['true', 'false']).default('false'),
    SHOPIFY_STORE_DOMAIN: z.string().min(1).default('local-test.myshopify.com'),
    SHOPIFY_ADMIN_ACCESS_TOKEN: z.string().default(''),
    SHOPIFY_API_VERSION: z.string().default('2026-07'),
    SHOPIFY_ONLINE_STORE_PUBLICATION_GID: z.string().default(''),
    OPENAI_API_KEY: z.string().default(''),
    OPENAI_MODE: z.enum(['mock', 'live']).default('mock'),
    SHOPIFY_WRITE_MODE: z.enum(['off', 'draft', 'publish']).default('off'),
    PUBLISH_KILL_SWITCH: z.enum(['true', 'false']).default('true'),
    MAX_BATCH_ITEMS: z.coerce.number().int().min(1).max(100).default(20),
    MAX_IMAGE_BYTES: z.coerce.number().int().min(1).default(25 * 1024 * 1024),
    MEDIA_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    MEDIA_STORAGE_PATH: z.string().min(1).default('../../var/product-publisher/media'),
    S3_ENDPOINT: z.string().default(''),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().default(''),
    S3_ACCESS_KEY_ID: z.string().default(''),
    S3_SECRET_ACCESS_KEY: z.string().default(''),
    S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('false'),
    RELEASE: z.string().default('development'),
    PIPELINE_VERSION: z.string().min(1).default('catalog-v1'),
  })
  .passthrough()
  .superRefine((config, context) => {
    if (config.NODE_ENV !== 'production') return;

    if (config.APP_ACCESS_TOKEN.length < 24) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_ACCESS_TOKEN'],
        message: 'APP_ACCESS_TOKEN must contain at least 24 characters in production',
      });
    }
    if (config.CORS_ORIGINS.split(',').every((origin) => origin.trim().length === 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS must contain the deployed frontend origin in production',
      });
    }
    if (config.MEDIA_STORAGE_DRIVER !== 's3') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MEDIA_STORAGE_DRIVER'],
        message: 'MEDIA_STORAGE_DRIVER must be s3 in production',
      });
    }
  });

export type ApiConfig = ReturnType<typeof readApiConfig>;

export function readApiConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = ConfigSchema.parse(env);
  return {
    nodeEnv: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    appAccessToken: parsed.APP_ACCESS_TOKEN,
    corsOrigins: parsed.CORS_ORIGINS
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl: parsed.DATABASE_URL,
    databaseSsl: parsed.DATABASE_SSL === 'true',
    shopDomain: parsed.SHOPIFY_STORE_DOMAIN,
    shopifyAccessToken: parsed.SHOPIFY_ADMIN_ACCESS_TOKEN,
    shopifyApiVersion: parsed.SHOPIFY_API_VERSION,
    shopifyOnlineStorePublicationGid: parsed.SHOPIFY_ONLINE_STORE_PUBLICATION_GID,
    // Folder-direct imports are deterministic and do not require an AI provider.
    openAiReady: true,
    openAiMode: parsed.OPENAI_MODE,
    shopifyWriteMode: parsed.SHOPIFY_WRITE_MODE,
    publishKillSwitch: parsed.PUBLISH_KILL_SWITCH === 'true',
    maxBatchItems: parsed.MAX_BATCH_ITEMS,
    maxImageBytes: parsed.MAX_IMAGE_BYTES,
    mediaStorageDriver: parsed.MEDIA_STORAGE_DRIVER,
    mediaStoragePath: parsed.MEDIA_STORAGE_PATH,
    s3Endpoint: parsed.S3_ENDPOINT,
    s3Region: parsed.S3_REGION,
    s3Bucket: parsed.S3_BUCKET,
    s3AccessKeyId: parsed.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: parsed.S3_SECRET_ACCESS_KEY,
    s3ForcePathStyle: parsed.S3_FORCE_PATH_STYLE === 'true',
    release: parsed.RELEASE,
    pipelineVersion: parsed.PIPELINE_VERSION,
  } as const;
}
