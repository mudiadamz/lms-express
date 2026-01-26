import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all classes
router.get('/', authenticateToken, (req, res) => {
  try {
    const { schoolLevel } = req.query;
    let query = `
      SELECT c.id, c.name, c.grade, c.school_level, c.homeroom_teacher_id,
             c.academic_year, c.semester, c.created_at,
             u.full_name as homeroom_teacher_name
      FROM classes c
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    if (schoolLevel) {
      query += ' AND c.school_level = ?';
      params.push(schoolLevel);
    }
    
    query += ' ORDER BY c.grade, c.name';

    const allClasses = db.prepare(query).all(...params) as any[];
    
    // Remove duplicates based on name + school_level combination
    // Keep the first occurrence (oldest by created_at if available, otherwise by id)
    const uniqueClassesMap = new Map<string, any>();
    allClasses.forEach((cls: any) => {
      const key = `${cls.name}_${cls.school_level}`;
      if (!uniqueClassesMap.has(key)) {
        uniqueClassesMap.set(key, cls);
      } else {
        // If duplicate found, keep the one with older created_at or smaller id
        const existing = uniqueClassesMap.get(key);
        const existingDate = existing.created_at ? new Date(existing.created_at).getTime() : 0;
        const currentDate = cls.created_at ? new Date(cls.created_at).getTime() : 0;
        if (currentDate < existingDate || (currentDate === existingDate && cls.id < existing.id)) {
          uniqueClassesMap.set(key, cls);
        }
      }
    });
    const classes = Array.from(uniqueClassesMap.values());

    const formattedClasses = classes.map(cls => {
      const students = db.prepare(`
        SELECT u.id, u.full_name, u.student_number
        FROM class_students cs
        JOIN users u ON cs.student_id = u.id
        WHERE cs.class_id = ?
      `).all(cls.id) as any[];
      const studentCount = db.prepare(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        LEFT JOIN class_students cs ON cs.student_id = u.id
        WHERE u.role = 'student' AND (u.class_id = ? OR cs.class_id = ?)
      `).get(cls.id, cls.id) as any;

      const subjects = db.prepare(`
        SELECT s.id, s.name, s.code
        FROM class_subjects cs
        JOIN subjects s ON cs.subject_id = s.id
        WHERE cs.class_id = ?
      `).all(cls.id) as any[];

      return {
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        schoolLevel: cls.school_level,
        homeroomTeacherId: cls.homeroom_teacher_id,
        homeroomTeacherName: cls.homeroom_teacher_name,
        studentIds: students.map(s => s.id),
        studentCount: studentCount?.count || 0,
        subjectIds: subjects.map(s => s.id),
        academicYear: cls.academic_year,
        semester: cls.semester,
      };
    });

    res.json({ success: true, data: formattedClasses });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get class by ID
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;

    const cls = db.prepare(`
      SELECT c.id, c.name, c.grade, c.school_level, c.homeroom_teacher_id,
             c.academic_year, c.semester, c.created_at,
             u.full_name as homeroom_teacher_name
      FROM classes c
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      WHERE c.id = ?
    `).get(id) as any;

    if (!cls) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    const students = db.prepare(`
      SELECT u.id, u.full_name, u.student_number
      FROM class_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const subjects = db.prepare(`
      SELECT s.id, s.name, s.code
      FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const studentCount = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN class_students cs ON cs.student_id = u.id
      WHERE u.role = 'student' AND (u.class_id = ? OR cs.class_id = ?)
    `).get(id, id) as any;

    res.json({
      success: true,
      data: {
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        schoolLevel: cls.school_level,
        homeroomTeacherId: cls.homeroom_teacher_id,
        homeroomTeacherName: cls.homeroom_teacher_name,
        studentIds: students.map(s => s.id),
        studentCount: studentCount?.count || 0,
        subjectIds: subjects.map(s => s.id),
        academicYear: cls.academic_year,
        semester: cls.semester,
      },
    });
  } catch (error) {
    console.error('Get class error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create class
router.post('/', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, grade, schoolLevel, homeroomTeacherId, academicYear, semester, studentIds, subjectIds } = req.body;

    if (!name || grade === undefined || !schoolLevel || !academicYear || semester === undefined) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO classes (id, name, grade, school_level, homeroom_teacher_id,
                           academic_year, semester)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, grade, schoolLevel, homeroomTeacherId || null, academicYear, semester);

    // Add students
    if (studentIds && Array.isArray(studentIds)) {
      const insertStudent = db.prepare(`
        INSERT INTO class_students (class_id, student_id) VALUES (?, ?)
      `);
      for (const studentId of studentIds) {
        insertStudent.run(id, studentId);
      }
    }

    // Add subjects
    if (subjectIds && Array.isArray(subjectIds)) {
      const insertSubject = db.prepare(`
        INSERT INTO class_subjects (class_id, subject_id) VALUES (?, ?)
      `);
      for (const subjectId of subjectIds) {
        insertSubject.run(id, subjectId);
      }
    }

    const cls = db.prepare(`
      SELECT c.id, c.name, c.grade, c.school_level, c.homeroom_teacher_id,
             c.academic_year, c.semester, c.created_at,
             u.full_name as homeroom_teacher_name
      FROM classes c
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      WHERE c.id = ?
    `).get(id) as any;

    const students = db.prepare(`
      SELECT u.id FROM class_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const subjects = db.prepare(`
      SELECT s.id FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const studentCount = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN class_students cs ON cs.student_id = u.id
      WHERE u.role = 'student' AND (u.class_id = ? OR cs.class_id = ?)
    `).get(id, id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: cls.id,
        name: cls.name,
        grade: cls.grade,
        schoolLevel: cls.school_level,
        homeroomTeacherId: cls.homeroom_teacher_id,
        homeroomTeacherName: cls.homeroom_teacher_name,
        studentIds: students.map(s => s.id),
        studentCount: studentCount?.count || 0,
        subjectIds: subjects.map(s => s.id),
        academicYear: cls.academic_year,
        semester: cls.semester,
      },
    });
  } catch (error) {
    console.error('Create class error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update class
router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;
    const { name, grade, schoolLevel, homeroomTeacherId, academicYear, semester, studentIds, subjectIds } = req.body;

    const cls = db.prepare('SELECT id FROM classes WHERE id = ?').get(id);
    if (!cls) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (grade !== undefined) { updates.push('grade = ?'); values.push(grade); }
    if (schoolLevel !== undefined) { updates.push('school_level = ?'); values.push(schoolLevel); }
    if (homeroomTeacherId !== undefined) { updates.push('homeroom_teacher_id = ?'); values.push(homeroomTeacherId); }
    if (academicYear !== undefined) { updates.push('academic_year = ?'); values.push(academicYear); }
    if (semester !== undefined) { updates.push('semester = ?'); values.push(semester); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE classes SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update students
    if (studentIds !== undefined) {
      db.prepare('DELETE FROM class_students WHERE class_id = ?').run(id);
      if (Array.isArray(studentIds) && studentIds.length > 0) {
        const insertStudent = db.prepare(`
          INSERT INTO class_students (class_id, student_id) VALUES (?, ?)
        `);
        for (const studentId of studentIds) {
          insertStudent.run(id, studentId);
        }
      }
    }

    // Update subjects
    if (subjectIds !== undefined) {
      db.prepare('DELETE FROM class_subjects WHERE class_id = ?').run(id);
      if (Array.isArray(subjectIds) && subjectIds.length > 0) {
        const insertSubject = db.prepare(`
          INSERT INTO class_subjects (class_id, subject_id) VALUES (?, ?)
        `);
        for (const subjectId of subjectIds) {
          insertSubject.run(id, subjectId);
        }
      }
    }

    const updatedClass = db.prepare(`
      SELECT c.id, c.name, c.grade, c.school_level, c.homeroom_teacher_id,
             c.academic_year, c.semester, c.created_at,
             u.full_name as homeroom_teacher_name
      FROM classes c
      LEFT JOIN users u ON c.homeroom_teacher_id = u.id
      WHERE c.id = ?
    `).get(id) as any;

    const students = db.prepare(`
      SELECT u.id FROM class_students cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const subjects = db.prepare(`
      SELECT s.id FROM class_subjects cs
      JOIN subjects s ON cs.subject_id = s.id
      WHERE cs.class_id = ?
    `).all(id) as any[];

    const updatedStudentCount = db.prepare(`
      SELECT COUNT(DISTINCT u.id) as count
      FROM users u
      LEFT JOIN class_students cs ON cs.student_id = u.id
      WHERE u.role = 'student' AND (u.class_id = ? OR cs.class_id = ?)
    `).get(id, id) as any;

    res.json({
      success: true,
      data: {
        id: updatedClass.id,
        name: updatedClass.name,
        grade: updatedClass.grade,
        schoolLevel: updatedClass.school_level,
        homeroomTeacherId: updatedClass.homeroom_teacher_id,
        homeroomTeacherName: updatedClass.homeroom_teacher_name,
        studentIds: students.map(s => s.id),
        studentCount: updatedStudentCount?.count || 0,
        subjectIds: subjects.map(s => s.id),
        academicYear: updatedClass.academic_year,
        semester: updatedClass.semester,
      },
    });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete class
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM classes WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Class not found' });
    }

    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (error) {
    console.error('Delete class error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
