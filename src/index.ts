import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createTables } from './database/schema.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import classRoutes from './routes/classes.js';
import subjectRoutes from './routes/subjects.js';
import assignmentRoutes from './routes/assignments.js';
import quizRoutes from './routes/quizzes.js';
import materialRoutes from './routes/materials.js';
import attendanceRoutes from './routes/attendance.js';
import gradeRoutes from './routes/grades.js';
import scheduleRoutes from './routes/schedules.js';
import forumRoutes from './routes/forums.js';
import messageRoutes from './routes/messages.js';
import notificationRoutes from './routes/notifications.js';
import announcementRoutes from './routes/announcements.js';
import reportCardRoutes from './routes/report-cards.js';
import academicYearRoutes from './routes/academic-years.js';
import paymentRoutes from './routes/payments.js';
import curriculumRoutes from './routes/curriculums.js';
import auditLogRoutes from './routes/audit-logs.js';
import excelRoutes from './routes/excel.js';
import settingsRoutes from './routes/settings.js';
import badgesRoutes from './routes/badges.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middleware - CORS (allow all for Railway deployment)
app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check - BEFORE database init to ensure it responds quickly
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Initialize database with error handling
let dbInitialized = false;
setTimeout(async () => {
  try {
    createTables();
    dbInitialized = true;
    console.log('✅ Database initialized successfully');
    
    // Check if users exist, if not, seed them
    try {
      const db = (await import('./database/db.js')).default;
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
      
      if (userCount.count === 0) {
        console.log('⚠️  No users found in database. Running ensure-seed...');
        const { execSync } = await import('child_process');
        try {
          execSync('npm run ensure-seed', { 
            cwd: process.cwd(),
            stdio: 'inherit',
            env: process.env
          });
          console.log('✅ Database seeded successfully');
        } catch (seedError: any) {
          console.error('⚠️  Auto-seed failed. Please run manually: npm run ensure-seed');
          console.error('Seed error:', seedError.message);
        }
      } else {
        console.log(`✅ Found ${userCount.count} users in database`);
      }
    } catch (checkError) {
      console.log('⚠️  Could not check users. Please run: npm run ensure-seed');
    }
  } catch (error: any) {
    console.error('❌ Database initialization error:', error);
    console.error('Error message:', error?.message);
    // Continue anyway - tables might already exist or will be created on first request
    if (error?.message?.includes('already exists')) {
      dbInitialized = true;
      console.log('✅ Tables already exist');
    }
  }
}, 1000); // Delay to ensure server starts first

// API Routes
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // Alias for convenience
app.use('/api/users', userRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/forums', forumRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/report-cards', reportCardRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/curriculums', curriculumRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/excel', excelRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/badges', badgesRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    success: true, 
    message: 'LMS API Server',
    database: dbInitialized ? 'initialized' : 'not initialized',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', path: req.path });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Request error:', err);
  console.error('Error stack:', err?.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Don't exit - let Railway handle restart
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 Server is running on port', PORT);
  console.log('🌐 API available at http://0.0.0.0:' + PORT + '/api');
  console.log('📊 Environment:', process.env.NODE_ENV || 'development');
  console.log('💾 Database initialized:', dbInitialized);
  console.log('✅ Server ready to accept connections');
}).on('error', (err: any) => {
  console.error('❌ Failed to start server:', err);
  console.error('Error code:', err.code);
  console.error('Error message:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for Vercel serverless (if needed)
export default app;
