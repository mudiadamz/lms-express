import { createTables } from './schema.js';

console.log('Running database migrations...');
try {
  createTables();
  console.log('Migrations completed!');
} catch (error: any) {
  console.error('Migration error:', error);
  // Don't exit - tables might already exist
  if (error.message && error.message.includes('already exists')) {
    console.log('Tables already exist, continuing...');
  } else {
    console.error('Migration failed, but continuing startup...');
    // Don't throw - let server start anyway
  }
}
