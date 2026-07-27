import { createDataSource } from './data-source.js';

const command = process.argv[2];
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const dataSource = createDataSource({
  databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true',
});

await dataSource.initialize();

try {
  if (command === 'migration:run') {
    await dataSource.runMigrations({ transaction: 'all' });
  } else if (command === 'migration:revert') {
    await dataSource.undoLastMigration({ transaction: 'all' });
  } else {
    throw new Error(`Unknown database command: ${command ?? '(missing)'}`);
  }
} finally {
  await dataSource.destroy();
}
