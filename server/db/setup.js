import { getDb, saveDb, execSQL } from './database.js';
import { migrate } from './migrations/001_initial.js';

async function setup() {
  console.log('🔧 Setting up database...');
  await getDb();
  migrate();
  saveDb();
  console.log('✅ Database setup complete.');
  process.exit(0);
}

setup().catch(err => {
  console.error('❌ Database setup failed:', err);
  process.exit(1);
});
