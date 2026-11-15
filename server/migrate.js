require('dotenv').config();
const db = require('./config/database');

async function runMigrations() {
  try {
    console.log('🚀 Running migrations...');
    await db.migrate.latest();
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function rollbackMigrations() {
  try {
    console.log('🔄 Rolling back migrations...');
    await db.migrate.rollback();
    console.log('✅ Rollback completed successfully');
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

async function seedData() {
  try {
    console.log('🌱 Seeding database...');
    await db.seed.run();
    console.log('✅ Seed completed successfully');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

async function rollbackSeeds() {
  try {
    console.log('🗑️ Rolling back seeds...');
    await db.seed.rollback();
    console.log('✅ Seed rollback completed successfully');
  } catch (error) {
    console.error('❌ Seed rollback failed:', error);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (command === 'rollback') {
    await rollbackMigrations();
  } else if (command === 'seed') {
    await seedData();
  } else if (command === 'seed:rollback') {
    await rollbackSeeds();
  } else {
    await runMigrations();
  }
  await db.destroy();
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});