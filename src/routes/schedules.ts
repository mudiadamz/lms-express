import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all schedules (with filters)
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, subjectId, teacherId, dayOfWeek, academicYear, semester } = req.query;

    let query = `
      SELECT s.id, s.class_id, s.subject_id, s.teacher_id, s.day_of_week, s.start_time, 
             s.end_time, s.room, s.academic_year, s.semester,
             c.name as class_name, sub.name as subject_name, sub.code as subject_code,
             u.full_name as teacher_name
      FROM schedules s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (classId) {
      query += ' AND s.class_id = ?';
      params.push(classId);
    }

    if (subjectId) {
      query += ' AND s.subject_id = ?';
      params.push(subjectId);
    }

    if (teacherId) {
      query += ' AND s.teacher_id = ?';
      params.push(teacherId);
    }

    if (dayOfWeek !== undefined) {
      query += ' AND s.day_of_week = ?';
      params.push(dayOfWeek);
    }

    if (academicYear) {
      query += ' AND s.academic_year = ?';
      params.push(academicYear);
    }

    if (semester !== undefined) {
      query += ' AND s.semester = ?';
      params.push(semester);
    }

    // Students can only see schedules for their class
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id) {
        query += ' AND s.class_id = ?';
        params.push(student.class_id);
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    query += ' ORDER BY s.day_of_week, s.start_time';

    const schedules = db.prepare(query).all(...params) as any[];

    const formattedSchedules = schedules.map(schedule => ({
      id: schedule.id,
      classId: schedule.class_id,
      subjectId: schedule.subject_id,
      teacherId: schedule.teacher_id,
      dayOfWeek: schedule.day_of_week,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      room: schedule.room,
      academicYear: schedule.academic_year,
      semester: schedule.semester,
      className: schedule.class_name,
      subjectName: schedule.subject_name,
      subjectCode: schedule.subject_code,
      teacherName: schedule.teacher_name,
    }));

    res.json({ success: true, data: formattedSchedules });
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get schedule by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const schedule = db.prepare(`
      SELECT s.id, s.class_id, s.subject_id, s.teacher_id, s.day_of_week, s.start_time, 
             s.end_time, s.room, s.academic_year, s.semester,
             c.name as class_name, sub.name as subject_name, sub.code as subject_code,
             u.full_name as teacher_name
      FROM schedules s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id !== schedule.class_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    res.json({
      success: true,
      data: {
        id: schedule.id,
        classId: schedule.class_id,
        subjectId: schedule.subject_id,
        teacherId: schedule.teacher_id,
        dayOfWeek: schedule.day_of_week,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        room: schedule.room,
        academicYear: schedule.academic_year,
        semester: schedule.semester,
        className: schedule.class_name,
        subjectName: schedule.subject_name,
        subjectCode: schedule.subject_code,
        teacherName: schedule.teacher_name,
      },
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create schedule (admin/teacher only)
router.post('/', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, academicYear, semester } = req.body;

    if (!classId || !subjectId || !teacherId || dayOfWeek === undefined || !startTime || !endTime || !academicYear || semester === undefined) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Teachers can only create schedules for themselves
    if (req.userRole === 'teacher' && teacherId !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO schedules (id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room || null, academicYear, semester);

    const schedule = db.prepare(`
      SELECT s.id, s.class_id, s.subject_id, s.teacher_id, s.day_of_week, s.start_time, 
             s.end_time, s.room, s.academic_year, s.semester,
             c.name as class_name, sub.name as subject_name, sub.code as subject_code,
             u.full_name as teacher_name
      FROM schedules s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: schedule.id,
        classId: schedule.class_id,
        subjectId: schedule.subject_id,
        teacherId: schedule.teacher_id,
        dayOfWeek: schedule.day_of_week,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        room: schedule.room,
        academicYear: schedule.academic_year,
        semester: schedule.semester,
        className: schedule.class_name,
        subjectName: schedule.subject_name,
        subjectCode: schedule.subject_code,
        teacherName: schedule.teacher_name,
      },
    });
  } catch (error: any) {
    console.error('Create schedule error:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ success: false, error: 'Schedule already exists' });
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update schedule (admin/teacher only)
router.put('/:id', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { classId, subjectId, teacherId, dayOfWeek, startTime, endTime, room, academicYear, semester } = req.body;

    const existing = db.prepare('SELECT teacher_id FROM schedules WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Teachers can only update their own schedules
    if (req.userRole === 'teacher' && existing.teacher_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (subjectId !== undefined) { updates.push('subject_id = ?'); values.push(subjectId); }
    if (teacherId !== undefined) {
      if (req.userRole === 'teacher' && teacherId !== req.userId) {
        return res.status(403).json({ success: false, error: 'Cannot change teacher' });
      }
      updates.push('teacher_id = ?'); values.push(teacherId);
    }
    if (dayOfWeek !== undefined) { updates.push('day_of_week = ?'); values.push(dayOfWeek); }
    if (startTime !== undefined) { updates.push('start_time = ?'); values.push(startTime); }
    if (endTime !== undefined) { updates.push('end_time = ?'); values.push(endTime); }
    if (room !== undefined) { updates.push('room = ?'); values.push(room); }
    if (academicYear !== undefined) { updates.push('academic_year = ?'); values.push(academicYear); }
    if (semester !== undefined) { updates.push('semester = ?'); values.push(semester); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const schedule = db.prepare(`
      SELECT s.id, s.class_id, s.subject_id, s.teacher_id, s.day_of_week, s.start_time, 
             s.end_time, s.room, s.academic_year, s.semester,
             c.name as class_name, sub.name as subject_name, sub.code as subject_code,
             u.full_name as teacher_name
      FROM schedules s
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN subjects sub ON s.subject_id = sub.id
      LEFT JOIN users u ON s.teacher_id = u.id
      WHERE s.id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: schedule.id,
        classId: schedule.class_id,
        subjectId: schedule.subject_id,
        teacherId: schedule.teacher_id,
        dayOfWeek: schedule.day_of_week,
        startTime: schedule.start_time,
        endTime: schedule.end_time,
        room: schedule.room,
        academicYear: schedule.academic_year,
        semester: schedule.semester,
        className: schedule.class_name,
        subjectName: schedule.subject_name,
        subjectCode: schedule.subject_code,
        teacherName: schedule.teacher_name,
      },
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete schedule (admin/teacher only)
router.delete('/:id', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT teacher_id FROM schedules WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    // Teachers can only delete their own schedules
    if (req.userRole === 'teacher' && existing.teacher_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM schedules WHERE id = ?').run(id);

    res.json({ success: true, message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
