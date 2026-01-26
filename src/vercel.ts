// Vercel Serverless Function entry point
// Note: SQLite tidak cocok untuk Vercel serverless
// Gunakan PostgreSQL atau deploy backend ke platform lain

import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend API',
    note: 'SQLite tidak didukung di Vercel serverless. Gunakan PostgreSQL atau deploy ke Railway/Render/Fly.io'
  });
});

export default app;
