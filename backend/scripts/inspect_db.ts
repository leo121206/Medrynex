import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  console.log('--- INSPECTING REAL POSTGRESQL DATABASE ---');
  
  // 1. List all tables
  const tables: any[] = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;
  console.log('Tables created in PostgreSQL:');
  for (const t of tables) {
    console.log(` - ${t.table_name}`);
  }

  // 2. List foreign key relationships
  const fks: any[] = await prisma.$queryRaw`
    SELECT
      tc.table_name, 
      kcu.column_name, 
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `;
  console.log('\nForeign Key Constraints verified:');
  for (const fk of fks) {
    console.log(` - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
  }

  // 3. List indexes
  const indexes: any[] = await prisma.$queryRaw`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;
  console.log('\nDatabase Indexes verified:');
  for (const idx of indexes) {
    console.log(` - ${idx.tablename}: ${idx.indexname}`);
  }

  await prisma.$disconnect();
}

inspect().catch((err) => {
  console.error('Inspection error:', err);
  process.exit(1);
});
