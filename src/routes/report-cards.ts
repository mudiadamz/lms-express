import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get report cards
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId, classId, academicYear, semester } = req.query;

    let query = `
      SELECT rc.id, rc.student_id, rc.class_id, rc.academic_year, rc.semester,
             rc.average_score, rc.rank, rc.teacher_notes, rc.created_at,
             u.full_name as student_name, c.name as class_name
      FROM report_cards rc
      LEFT JOIN users u ON rc.student_id = u.id
      LEFT JOIN classes c ON rc.class_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Students can only see their own report cards
    if (req.userRole === 'student') {
      query += ' AND rc.student_id = ?';
      params.push(req.userId);
    } else if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id) {
        query += ' AND rc.student_id = ?';
        params.push(parent.student_id);
      } else {
        return res.json({ success: true, data: [] });
      }
    } else {
      if (studentId) {
        query += ' AND rc.student_id = ?';
        params.push(studentId);
      }
    }

    if (classId) {
      query += ' AND rc.class_id = ?';
      params.push(classId);
    }

    if (academicYear) {
      query += ' AND rc.academic_year = ?';
      params.push(academicYear);
    }

    if (semester !== undefined) {
      query += ' AND rc.semester = ?';
      params.push(semester);
    }

    query += ' ORDER BY rc.academic_year DESC, rc.semester DESC';

    const reportCards = db.prepare(query).all(...params) as any[];

    // Get grades for each report card
    const reportCardsWithGrades = reportCards.map(rc => {
      const grades = db.prepare(`
        SELECT g.id, g.student_id, g.subject_id, g.assignment_id, g.quiz_id, g.score, g.max_score,
               g.type, g.teacher_id, g.notes, g.created_at,
               s.name as subject_name, s.code as subject_code
        FROM grades g
        LEFT JOIN subjects s ON g.subject_id = s.id
        WHERE g.student_id = ? AND g.type IN ('midterm', 'final')
        ORDER BY s.name
      `).all(rc.student_id) as any[];

      return {
        id: rc.id,
        studentId: rc.student_id,
        studentName: rc.student_name,
        classId: rc.class_id,
        className: rc.class_name,
        academicYear: rc.academic_year,
        semester: rc.semester,
        averageScore: rc.average_score,
        rank: rc.rank,
        teacherNotes: rc.teacher_notes,
        grades: grades.map(g => ({
          id: g.id,
          subjectId: g.subject_id,
          subjectName: g.subject_name,
          subjectCode: g.subject_code,
          assignmentId: g.assignment_id,
          quizId: g.quiz_id,
          score: g.score,
          maxScore: g.max_score,
          type: g.type,
          teacherId: g.teacher_id,
          notes: g.notes,
          createdAt: new Date(g.created_at),
        })),
        createdAt: new Date(rc.created_at),
      };
    });

    res.json({ success: true, data: reportCardsWithGrades });
  } catch (error) {
    console.error('Get report cards error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get report card by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const reportCard = db.prepare(`
      SELECT rc.id, rc.student_id, rc.class_id, rc.academic_year, rc.semester,
             rc.average_score, rc.rank, rc.teacher_notes, rc.created_at,
             u.full_name as student_name, c.name as class_name
      FROM report_cards rc
      LEFT JOIN users u ON rc.student_id = u.id
      LEFT JOIN classes c ON rc.class_id = c.id
      WHERE rc.id = ?
    `).get(id) as any;

    if (!reportCard) {
      return res.status(404).json({ success: false, error: 'Report card not found' });
    }

    // Check permissions
    if (req.userRole === 'student' && reportCard.student_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id !== reportCard.student_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const grades = db.prepare(`
      SELECT g.id, g.student_id, g.subject_id, g.assignment_id, g.quiz_id, g.score, g.max_score,
             g.type, g.teacher_id, g.notes, g.created_at,
             s.name as subject_name, s.code as subject_code
      FROM grades g
      LEFT JOIN subjects s ON g.subject_id = s.id
      WHERE g.student_id = ? AND g.type IN ('midterm', 'final')
      ORDER BY s.name
    `).all(reportCard.student_id) as any[];

    res.json({
      success: true,
      data: {
        id: reportCard.id,
        studentId: reportCard.student_id,
        studentName: reportCard.student_name,
        classId: reportCard.class_id,
        className: reportCard.class_name,
        academicYear: reportCard.academic_year,
        semester: reportCard.semester,
        averageScore: reportCard.average_score,
        rank: reportCard.rank,
        teacherNotes: reportCard.teacher_notes,
        grades: grades.map(g => ({
          id: g.id,
          subjectId: g.subject_id,
          subjectName: g.subject_name,
          subjectCode: g.subject_code,
          assignmentId: g.assignment_id,
          quizId: g.quiz_id,
          score: g.score,
          maxScore: g.max_score,
          type: g.type,
          teacherId: g.teacher_id,
          notes: g.notes,
          createdAt: new Date(g.created_at),
        })),
        createdAt: new Date(reportCard.created_at),
      },
    });
  } catch (error) {
    console.error('Get report card error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Generate report card (admin/teacher only)
router.post('/generate', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { studentId, classId, academicYear, semester } = req.body;

    if (!studentId || !classId || !academicYear || semester === undefined) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Check if report card already exists
    const existing = db.prepare(`
      SELECT id FROM report_cards 
      WHERE student_id = ? AND class_id = ? AND academic_year = ? AND semester = ?
    `).get(studentId, classId, academicYear, semester) as any;

    if (existing) {
      return res.status(400).json({ success: false, error: 'Report card already exists for this period' });
    }

    // Get all grades for the student in this period
    const grades = db.prepare(`
      SELECT score, max_score FROM grades
      WHERE student_id = ? AND type IN ('midterm', 'final')
    `).all(studentId) as any[];

    if (grades.length === 0) {
      return res.status(400).json({ success: false, error: 'No grades found for this student' });
    }

    // Calculate average score
    let totalScore = 0;
    let totalMaxScore = 0;
    for (const grade of grades) {
      totalScore += grade.score;
      totalMaxScore += grade.max_score;
    }
    const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    // Calculate rank (students with same average score get same rank)
    const studentsInClass = db.prepare(`
      SELECT DISTINCT g.student_id,
             SUM(g.score) as total_score,
             SUM(g.max_score) as total_max_score
      FROM grades g
      JOIN class_students cs ON g.student_id = cs.student_id
      WHERE cs.class_id = ? AND g.type IN ('midterm', 'final')
      GROUP BY g.student_id
      ORDER BY (SUM(g.score) * 100.0 / SUM(g.max_score)) DESC
    `).all(classId) as any[];

    let rank = null;
    for (let i = 0; i < studentsInClass.length; i++) {
      const studentAvg = studentsInClass[i].total_max_score > 0
        ? (studentsInClass[i].total_score / studentsInClass[i].total_max_score) * 100
        : 0;
      if (studentsInClass[i].student_id === studentId) {
        rank = i + 1;
        break;
      }
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO report_cards (id, student_id, class_id, academic_year, semester, average_score, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, studentId, classId, academicYear, semester, averageScore, rank);

    const reportCard = db.prepare(`
      SELECT rc.id, rc.student_id, rc.class_id, rc.academic_year, rc.semester,
             rc.average_score, rc.rank, rc.teacher_notes, rc.created_at,
             u.full_name as student_name, c.name as class_name
      FROM report_cards rc
      LEFT JOIN users u ON rc.student_id = u.id
      LEFT JOIN classes c ON rc.class_id = c.id
      WHERE rc.id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: reportCard.id,
        studentId: reportCard.student_id,
        studentName: reportCard.student_name,
        classId: reportCard.class_id,
        className: reportCard.class_name,
        academicYear: reportCard.academic_year,
        semester: reportCard.semester,
        averageScore: reportCard.average_score,
        rank: reportCard.rank,
        teacherNotes: reportCard.teacher_notes,
        createdAt: new Date(reportCard.created_at),
      },
    });
  } catch (error) {
    console.error('Generate report card error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update report card (admin/teacher only)
router.put('/:id', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { teacherNotes, rank } = req.body;

    const existing = db.prepare('SELECT id FROM report_cards WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Report card not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (teacherNotes !== undefined) { updates.push('teacher_notes = ?'); values.push(teacherNotes); }
    if (rank !== undefined) { updates.push('rank = ?'); values.push(rank); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE report_cards SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const reportCard = db.prepare(`
      SELECT rc.id, rc.student_id, rc.class_id, rc.academic_year, rc.semester,
             rc.average_score, rc.rank, rc.teacher_notes, rc.created_at,
             u.full_name as student_name, c.name as class_name
      FROM report_cards rc
      LEFT JOIN users u ON rc.student_id = u.id
      LEFT JOIN classes c ON rc.class_id = c.id
      WHERE rc.id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: reportCard.id,
        studentId: reportCard.student_id,
        studentName: reportCard.student_name,
        classId: reportCard.class_id,
        className: reportCard.class_name,
        academicYear: reportCard.academic_year,
        semester: reportCard.semester,
        averageScore: reportCard.average_score,
        rank: reportCard.rank,
        teacherNotes: reportCard.teacher_notes,
        createdAt: new Date(reportCard.created_at),
      },
    });
  } catch (error) {
    console.error('Update report card error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
