import { join } from 'node:path';
import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { seedAdmin } from './auth/seed.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const dbPath = config.DATA_DIR === ':memory:' ? ':memory:' : join(config.DATA_DIR, 'app.db');
  const db = createDb(dbPath);
  const created = seedAdmin(db, {
    username: config.ADMIN_USERNAME,
    password: config.ADMIN_PASSWORD,
  });
  const app = await buildApp({ db, config });
  if (created) app.log.info(`已创建初始管理员: ${config.ADMIN_USERNAME}`);
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
