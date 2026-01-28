import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get curriculums
router.get('/', authenticateToken, (req, res) => {
  try {
    const { schoolLevel } = req.query;
    let query = `
      SELECT id, name, description, school_level, is_active, start_date, end_date, created_at
      FROM curriculums
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (schoolLevel && schoolLevel !== 'all') {
      query += ' AND (school_level = ? OR school_level = ?)';
      params.push(schoolLevel, 'all');
    }
    
    query += ' ORDER BY is_active DESC, created_at DESC';

    const curriculums = db.prepare(query).all(...params) as any[];

    const formattedCurriculums = curriculums.map(curriculum => ({
      id: curriculum.id,
      name: curriculum.name,
      description: curriculum.description,
      schoolLevel: curriculum.school_level,
      isActive: curriculum.is_active === 1,
      startDate: new Date(curriculum.start_date),
      endDate: curriculum.end_date ? new Date(curriculum.end_date) : undefined,
      createdAt: new Date(curriculum.created_at),
    }));

    res.json({ success: true, data: formattedCurriculums });
  } catch (error) {
    console.error('Get curriculums error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get curriculum by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const curriculum = db.prepare(`
      SELECT id, name, description, school_level, is_active, start_date, end_date, created_at
      FROM curriculums
      WHERE id = ?
    `).get(id) as any;

    if (!curriculum) {
      return res.status(404).json({ success: false, error: 'Curriculum not found' });
    }

    res.json({
      success: true,
      data: {
        id: curriculum.id,
        name: curriculum.name,
        description: curriculum.description,
        schoolLevel: curriculum.school_level,
        isActive: curriculum.is_active === 1,
        startDate: new Date(curriculum.start_date),
        endDate: curriculum.end_date ? new Date(curriculum.end_date) : undefined,
        createdAt: new Date(curriculum.created_at),
      },
    });
  } catch (error) {
    console.error('Get curriculum error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create curriculum
router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { name, description, schoolLevel, startDate, endDate } = req.body;

    if (!name || !description || !schoolLevel) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO curriculums (id, name, description, school_level, is_active, start_date, end_date, created_at)
      VALUES (?, ?, ?, ?, 0, ?, ?, datetime('now'))
    `).run(
      id,
      name,
      description,
      schoolLevel,
      startDate || null,
      endDate || null
    );

    const curriculum = db.prepare(`
      SELECT id, name, description, school_level, is_active, start_date, end_date, created_at
      FROM curriculums
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: curriculum.id,
        name: curriculum.name,
        description: curriculum.description,
        schoolLevel: curriculum.school_level,
        isActive: curriculum.is_active === 1,
        startDate: new Date(curriculum.start_date),
        endDate: curriculum.end_date ? new Date(curriculum.end_date) : undefined,
        createdAt: new Date(curriculum.created_at),
      },
    });
  } catch (error) {
    console.error('Create curriculum error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update curriculum
router.put('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, schoolLevel, startDate, endDate } = req.body;

    const curriculum = db.prepare('SELECT id FROM curriculums WHERE id = ?').get(id) as any;
    if (!curriculum) {
      return res.status(404).json({ success: false, error: 'Curriculum not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (schoolLevel !== undefined) { updates.push('school_level = ?'); values.push(schoolLevel); }
    if (startDate !== undefined) { updates.push('start_date = ?'); values.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); values.push(endDate); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE curriculums SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedCurriculum = db.prepare(`
      SELECT id, name, description, school_level, is_active, start_date, end_date, created_at
      FROM curriculums
      WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: updatedCurriculum.id,
        name: updatedCurriculum.name,
        description: updatedCurriculum.description,
        schoolLevel: updatedCurriculum.school_level,
        isActive: updatedCurriculum.is_active === 1,
        startDate: new Date(updatedCurriculum.start_date),
        endDate: updatedCurriculum.end_date ? new Date(updatedCurriculum.end_date) : undefined,
        createdAt: new Date(updatedCurriculum.created_at),
      },
    });
  } catch (error) {
    console.error('Update curriculum error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Activate curriculum
router.post('/:id/activate', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const curriculum = db.prepare('SELECT id FROM curriculums WHERE id = ?').get(id) as any;
    if (!curriculum) {
      return res.status(404).json({ success: false, error: 'Curriculum not found' });
    }

    // Deactivate all curriculums first
    db.prepare('UPDATE curriculums SET is_active = 0').run();
    
    // Activate selected curriculum
    db.prepare('UPDATE curriculums SET is_active = 1 WHERE id = ?').run(id);

    const activatedCurriculum = db.prepare(`
      SELECT id, name, description, school_level, is_active, start_date, end_date, created_at
      FROM curriculums
      WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: activatedCurriculum.id,
        name: activatedCurriculum.name,
        description: activatedCurriculum.description,
        schoolLevel: activatedCurriculum.school_level,
        isActive: activatedCurriculum.is_active === 1,
        startDate: new Date(activatedCurriculum.start_date),
        endDate: activatedCurriculum.end_date ? new Date(activatedCurriculum.end_date) : undefined,
        createdAt: new Date(activatedCurriculum.created_at),
      },
    });
  } catch (error) {
    console.error('Activate curriculum error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete curriculum
router.delete('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const curriculum = db.prepare('SELECT id, is_active FROM curriculums WHERE id = ?').get(id) as any;
    if (!curriculum) {
      return res.status(404).json({ success: false, error: 'Curriculum not found' });
    }

    if (curriculum.is_active === 1) {
      return res.status(400).json({ success: false, error: 'Cannot delete active curriculum' });
    }

    db.prepare('DELETE FROM curriculums WHERE id = ?').run(id);

    res.json({ success: true, message: 'Curriculum deleted successfully' });
  } catch (error) {
    console.error('Delete curriculum error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
