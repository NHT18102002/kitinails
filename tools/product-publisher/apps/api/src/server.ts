import { createDataSource } from '@ersa/product-publisher-db';
import { buildApp } from './app.js';
import { readApiConfig } from './config.js';

const config = readApiConfig();
const dataSource = createDataSource({
  databaseUrl: config.databaseUrl,
  ssl: config.databaseSsl,
});

await dataSource.initialize();
const app = await buildApp({ config, dataSource });

const shutdown = async () => {
  await app.close();
  if (dataSource.isInitialized) await dataSource.destroy();
};

process.once('SIGINT', () => void shutdown().finally(() => process.exit(0)));
process.once('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

await app.listen({ host: config.host, port: config.port });
