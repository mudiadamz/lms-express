import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/lms.db');
const dbDir = path.dirname(dbPath);

// Create database directory if it doesn't exist
try {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (error) {
  console.error('Error creating database directory:', error);
}

let db: any;

try {
  db = new Database(dbPath);
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  console.log('Database connected:', dbPath);
} catch (error: any) {
  console.error('Database connection error:', error);
  console.error('Error details:', error.message);
  console.error('Stack:', error.stack);
  // In Railway, better-sqlite3 should be compiled during build
  // If it fails, we need to see the error but might want to continue
  // For now, throw to see the error in logs
  throw error;
}

// Export database instance
// Using any to avoid TypeScript export type error with better-sqlite3
export default db as any;
