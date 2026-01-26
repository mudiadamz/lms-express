import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all academic years
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { isActive } = req.query;

    let query = 'SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE 1=1';
    const params: any[] = [];

    if (isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(isActive === 'true' || isActive === '1' ? 1 : 0);
    }

    query += ' ORDER BY start_date DESC';

    const academicYears = db.prepare(query).all(...params) as any[];

    const formatted = academicYears.map(ay => ({
      id: ay.id,
      name: ay.name,
      startDate: ay.start_date,
      endDate: ay.end_date,
      isActive: ay.is_active === 1,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get academic years error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get academic year by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const academicYear = db.prepare('SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE id = ?').get(id) as any;

    if (!academicYear) {
      return res.status(404).json({ success: false, error: 'Academic year not found' });
    }

    res.json({
      success: true,
      data: {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.start_date,
        endDate: academicYear.end_date,
        isActive: academicYear.is_active === 1,
      },
    });
  } catch (error) {
    console.error('Get academic year error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create academic year (admin only)
router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { name, startDate, endDate, isActive } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO academic_years (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, startDate, endDate, isActive ? 1 : 0);

    const academicYear = db.prepare('SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE id = ?').get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.start_date,
        endDate: academicYear.end_date,
        isActive: academicYear.is_active === 1,
      },
    });
  } catch (error: any) {
    console.error('Create academic year error:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Academic year name already exists' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update academic year (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isActive } = req.body;

    const existing = db.prepare('SELECT id FROM academic_years WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Academic year not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (startDate !== undefined) { updates.push('start_date = ?'); values.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); values.push(endDate); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE academic_years SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const academicYear = db.prepare('SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE id = ?').get(id) as any;

    res.json({
      success: true,
      data: {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.start_date,
        endDate: academicYear.end_date,
        isActive: academicYear.is_active === 1,
      },
    });
  } catch (error: any) {
    console.error('Update academic year error:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Academic year name already exists' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Set active academic year (admin only) - deactivates others
router.post('/:id/activate', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT id FROM academic_years WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Academic year not found' });
    }

    // Deactivate all
    db.prepare('UPDATE academic_years SET is_active = 0').run();

    // Activate this one
    db.prepare('UPDATE academic_years SET is_active = 1 WHERE id = ?').run(id);

    const academicYear = db.prepare('SELECT id, name, start_date, end_date, is_active FROM academic_years WHERE id = ?').get(id) as any;

    res.json({
      success: true,
      data: {
        id: academicYear.id,
        name: academicYear.name,
        startDate: academicYear.start_date,
        endDate: academicYear.end_date,
        isActive: academicYear.is_active === 1,
      },
    });
  } catch (error) {
    console.error('Activate academic year error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
