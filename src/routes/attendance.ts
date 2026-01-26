import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get attendance
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId, classId, subjectId, date } = req.query;
    let query = `
      SELECT id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at
      FROM attendance
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (studentId) {
      query += ' AND student_id = ?';
      params.push(studentId);
    }
    
    if (classId) {
      query += ' AND class_id = ?';
      params.push(classId);
    }
    
    if (subjectId) {
      query += ' AND subject_id = ?';
      params.push(subjectId);
    }
    
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    
    // Students can only see their own attendance
    if (req.userRole === 'student') {
      query += ' AND student_id = ?';
      params.push(req.userId);
    }
    
    // Parents can see their child's attendance
    if (req.userRole === 'parent') {
      const user = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.student_id) {
        query += ' AND student_id = ?';
        params.push(user.student_id);
      }
    }
    
    query += ' ORDER BY date DESC';

    const attendance = db.prepare(query).all(...params) as any[];

    const formattedAttendance = attendance.map(att => ({
      id: att.id,
      studentId: att.student_id,
      classId: att.class_id,
      subjectId: att.subject_id,
      date: new Date(att.date),
      status: att.status,
      notes: att.notes,
      recordedBy: att.recorded_by,
      createdAt: new Date(att.created_at),
    }));

    res.json({ success: true, data: formattedAttendance });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create attendance
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId, classId, subjectId, date, status, notes } = req.body;

    if (!studentId || !classId || !subjectId || !date || !status) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Only teachers and admins can create attendance
    if (req.userRole !== 'teacher' && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT OR REPLACE INTO attendance (id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, studentId, classId, subjectId, date, status, notes || null, req.userId);

    const attendance = db.prepare(`
      SELECT id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at
      FROM attendance
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: attendance.id,
        studentId: attendance.student_id,
        classId: attendance.class_id,
        subjectId: attendance.subject_id,
        date: new Date(attendance.date),
        status: attendance.status,
        notes: attendance.notes,
        recordedBy: attendance.recorded_by,
        createdAt: new Date(attendance.created_at),
      },
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Bulk create attendance
router.post('/bulk', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, subjectId, date, attendances } = req.body;

    if (!classId || !subjectId || !date || !attendances || !Array.isArray(attendances)) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Only teachers and admins can create attendance
    if (req.userRole !== 'teacher' && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const insertAttendance = db.prepare(`
      INSERT OR REPLACE INTO attendance (id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const created: any[] = [];

    for (const att of attendances) {
      const id = crypto.randomUUID();
      insertAttendance.run(
        id,
        att.studentId,
        classId,
        subjectId,
        date,
        att.status,
        att.notes || null,
        req.userId
      );

      const attendance = db.prepare(`
        SELECT id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at
        FROM attendance
        WHERE id = ?
      `).get(id) as any;

      created.push({
        id: attendance.id,
        studentId: attendance.student_id,
        classId: attendance.class_id,
        subjectId: attendance.subject_id,
        date: new Date(attendance.date),
        status: attendance.status,
        notes: attendance.notes,
        recordedBy: attendance.recorded_by,
        createdAt: new Date(attendance.created_at),
      });
    }

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Bulk create attendance error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update attendance
router.put('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const attendance = db.prepare('SELECT recorded_by FROM attendance WHERE id = ?').get(id) as any;
    if (!attendance) {
      return res.status(404).json({ success: false, error: 'Attendance not found' });
    }

    // Only teacher who recorded or admin can update
    if (attendance.recorded_by !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE attendance SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedAttendance = db.prepare(`
      SELECT id, student_id, class_id, subject_id, date, status, notes, recorded_by, created_at
      FROM attendance
      WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: updatedAttendance.id,
        studentId: updatedAttendance.student_id,
        classId: updatedAttendance.class_id,
        subjectId: updatedAttendance.subject_id,
        date: new Date(updatedAttendance.date),
        status: updatedAttendance.status,
        notes: updatedAttendance.notes,
        recordedBy: updatedAttendance.recorded_by,
        createdAt: new Date(updatedAttendance.created_at),
      },
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
