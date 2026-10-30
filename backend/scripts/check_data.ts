import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, patientId: true, doctorId: true },
  });
  const records = await prisma.recordMetadata.findMany({
    select: { id: true, title: true, category: true, patientId: true },
  });
  const emergencies = await prisma.emergencyEvent.findMany();

  console.log('=== CURRENT DB STATE ===');
  console.log(`Users count: ${users.length}`);
  for (const u of users) {
    console.log(`  [${u.role}] ${u.name} (${u.email}) - id: ${u.id}, patientId: ${u.patientId}, doctorId: ${u.doctorId}`);
  }

  console.log(`\nRecords count: ${records.length}`);
  for (const r of records) {
    console.log(`  ${r.title} [${r.category}] -> patientId: ${r.patientId}`);
  }

  console.log(`\nEmergency events count: ${emergencies.length}`);
  await prisma.$disconnect();
}

main().catch(console.error);
