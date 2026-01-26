import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all subjects
router.get('/', authenticateToken, (req, res) => {
  try {
    const { schoolLevel, teacherId } = req.query;
    let query = `
      SELECT s.id, s.name, s.code, s.description, s.school_level, s.teacher_id, s.created_at,
             u.full_name as teacher_name
      FROM subjects s
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    if (schoolLevel) {
      query += ' AND s.school_level = ?';
      params.push(schoolLevel);
    }
    if (teacherId) {
      query += ' AND s.teacher_id = ?';
      params.push(teacherId);
    }
    
    query += ' ORDER BY s.name';

    const subjects = db.prepare(query).all(...params) as any[];

    const formattedSubjects = subjects.map(subject => {
      const classes = db.prepare(`
        SELECT c.id, c.name
        FROM class_subjects cs
        JOIN classes c ON cs.class_id = c.id
        WHERE cs.subject_id = ?
      `).all(subject.id) as any[];

      return {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        schoolLevel: subject.school_level,
        teacherId: subject.teacher_id,
        teacherName: subject.teacher_name,
        classIds: classes.map(c => c.id),
      };
    });

    res.json({ success: true, data: formattedSubjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get subject by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const subject = db.prepare(`
      SELECT s.id, s.name, s.code, s.description, s.school_level, s.teacher_id, s.created_at,
             u.full_name as teacher_name
      FROM subjects s
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    const classes = db.prepare(`
      SELECT c.id, c.name
      FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.subject_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        schoolLevel: subject.school_level,
        teacherId: subject.teacher_id,
        teacherName: subject.teacher_name,
        classIds: classes.map(c => c.id),
      },
    });
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create subject
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, code, description, schoolLevel, teacherId, classIds } = req.body;

    if (!name || !code || !schoolLevel || !teacherId) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Check if code already exists
    const existingSubject = db.prepare('SELECT id FROM subjects WHERE code = ?').get(code);
    if (existingSubject) {
      return res.status(400).json({ success: false, error: 'Subject code already exists' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO subjects (id, name, code, description, school_level, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, code, description || null, schoolLevel, teacherId);

    // Add to classes
    if (classIds && Array.isArray(classIds)) {
      const insertClass = db.prepare(`
        INSERT INTO class_subjects (class_id, subject_id) VALUES (?, ?)
      `);
      for (const classId of classIds) {
        insertClass.run(classId, id);
      }
    }

    const subject = db.prepare(`
      SELECT s.id, s.name, s.code, s.description, s.school_level, s.teacher_id, s.created_at,
             u.full_name as teacher_name
      FROM subjects s
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    const classes = db.prepare(`
      SELECT c.id FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.subject_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        description: subject.description,
        schoolLevel: subject.school_level,
        teacherId: subject.teacher_id,
        teacherName: subject.teacher_name,
        classIds: classes.map(c => c.id),
      },
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update subject
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, description, schoolLevel, teacherId, classIds } = req.body;

    const subject = db.prepare('SELECT id FROM subjects WHERE id = ?').get(id);
    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    // Check code uniqueness if changed
    if (code) {
      const codeCheck = db.prepare('SELECT id FROM subjects WHERE code = ? AND id != ?').get(code, id);
      if (codeCheck) {
        return res.status(400).json({ success: false, error: 'Subject code already exists' });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (code !== undefined) { updates.push('code = ?'); values.push(code); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (schoolLevel !== undefined) { updates.push('school_level = ?'); values.push(schoolLevel); }
    if (teacherId !== undefined) { updates.push('teacher_id = ?'); values.push(teacherId); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update classes
    if (classIds !== undefined) {
      db.prepare('DELETE FROM class_subjects WHERE subject_id = ?').run(id);
      if (Array.isArray(classIds) && classIds.length > 0) {
        const insertClass = db.prepare(`
          INSERT INTO class_subjects (class_id, subject_id) VALUES (?, ?)
        `);
        for (const classId of classIds) {
          insertClass.run(classId, id);
        }
      }
    }

    const updatedSubject = db.prepare(`
      SELECT s.id, s.name, s.code, s.description, s.school_level, s.teacher_id, s.created_at,
             u.full_name as teacher_name
      FROM subjects s
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    const classes = db.prepare(`
      SELECT c.id FROM class_subjects cs
      JOIN classes c ON cs.class_id = c.id
      WHERE cs.subject_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: updatedSubject.id,
        name: updatedSubject.name,
        code: updatedSubject.code,
        description: updatedSubject.description,
        schoolLevel: updatedSubject.school_level,
        teacherId: updatedSubject.teacher_id,
        teacherName: updatedSubject.teacher_name,
        classIds: classes.map(c => c.id),
      },
    });
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete subject
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
