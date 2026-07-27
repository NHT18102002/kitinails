import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from './entities/index.js';
import { InitialSchema1784419200000 } from './migrations/001-initial-schema.js';

export interface DataSourceOptions {
  databaseUrl: string;
  ssl?: boolean;
  logging?: boolean;
}

export function createDataSource(options: DataSourceOptions): DataSource {
  return new DataSource({
    type: 'postgres',
    url: options.databaseUrl,
    ssl: options.ssl ? { rejectUnauthorized: true } : false,
    logging: options.logging ?? false,
    synchronize: false,
    entities: [...entities],
    migrations: [InitialSchema1784419200000],
    migrationsTableName: 'product_publisher_migrations',
  });
}
