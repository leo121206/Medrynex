import EmbeddedPostgres from 'embedded-postgres';
import path from 'path';
import fs from 'fs';

const dataDir = process.env.PGDATA || path.resolve(__dirname, '..', '.pgdata');

async function main() {
  console.log('🚀 Initializing Embedded PostgreSQL at:', dataDir);
  
  const isAlreadyInit = fs.existsSync(path.join(dataDir, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    port: 5432,
    user: 'postgres',
    password: 'password',
    persistent: true,
  });

  if (!isAlreadyInit) {
    console.log('📦 Running pg.initialise()...');
    await pg.initialise();
    console.log('✅ Initialised cluster successfully.');
  } else {
    console.log('ℹ️ Cluster already initialised.');
  }

  console.log('🔌 Starting PostgreSQL on port 5432...');
  await pg.start();
  console.log('✅ PostgreSQL is running on port 5432!');

  try {
    console.log('Creating database "medrynx_db"...');
    await pg.createDatabase('medrynx_db');
    console.log('✅ Database "medrynx_db" created successfully!');
  } catch (err: any) {
    if (err?.message?.includes('already exists')) {
      console.log('ℹ️ Database "medrynx_db" already exists.');
    } else {
      console.log('Database creation note:', err.message);
    }
  }

  console.log('🐘 PostgreSQL service ready to accept connections.');
  console.log('DATABASE_URL=postgresql://postgres:password@localhost:5432/medrynx_db?schema=public');

  // Keep process alive
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('Fatal PostgreSQL launch error:', err);
  process.exit(1);
});
