import { describe, expect, it } from 'vitest';
import { readApiConfig } from './config.js';

const productionBase = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://publisher:secret@example.test:5432/publisher',
  MEDIA_STORAGE_DRIVER: 's3',
  APP_ACCESS_TOKEN: 'a-secure-team-token-with-32-chars',
  CORS_ORIGINS: 'https://publisher.example.test',
} satisfies NodeJS.ProcessEnv;

describe('API deployment configuration', () => {
  it('normalizes an explicit CORS allowlist', () => {
    const config = readApiConfig({
      ...productionBase,
      CORS_ORIGINS: 'https://publisher.example.test, https://preview.example.test ',
    });

    expect(config.corsOrigins).toEqual([
      'https://publisher.example.test',
      'https://preview.example.test',
    ]);
  });

  it('rejects production without a strong tool access token', () => {
    expect(() => readApiConfig({
      ...productionBase,
      APP_ACCESS_TOKEN: 'short',
    })).toThrow(/APP_ACCESS_TOKEN/);
  });

  it('rejects ephemeral local media storage in production', () => {
    expect(() => readApiConfig({
      ...productionBase,
      MEDIA_STORAGE_DRIVER: 'local',
    })).toThrow(/MEDIA_STORAGE_DRIVER/);
  });
});
