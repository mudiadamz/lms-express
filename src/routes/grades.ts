import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get grades
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId, subjectId, assignmentId, quizId } = req.query;
    let query = `
      SELECT id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
             type, teacher_id, notes, created_at
      FROM grades
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (studentId) {
      query += ' AND student_id = ?';
      params.push(studentId);
    }
    
    if (subjectId) {
      query += ' AND subject_id = ?';
      params.push(subjectId);
    }
    
    if (assignmentId) {
      query += ' AND assignment_id = ?';
      params.push(assignmentId);
    }
    
    if (quizId) {
      query += ' AND quiz_id = ?';
      params.push(quizId);
    }
    
    // Students can only see their own grades
    if (req.userRole === 'student') {
      query += ' AND student_id = ?';
      params.push(req.userId);
    }
    
    // Parents can see their child's grades
    if (req.userRole === 'parent') {
      const user = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.student_id) {
        query += ' AND student_id = ?';
        params.push(user.student_id);
      }
    }
    
    query += ' ORDER BY created_at DESC';

    const grades = db.prepare(query).all(...params) as any[];

    const formattedGrades = grades.map(grade => ({
      id: grade.id,
      studentId: grade.student_id,
      subjectId: grade.subject_id,
      assignmentId: grade.assignment_id,
      quizId: grade.quiz_id,
      score: grade.score,
      maxScore: grade.max_score,
      type: grade.type,
      teacherId: grade.teacher_id,
      notes: grade.notes,
      createdAt: new Date(grade.created_at),
    }));

    res.json({ success: true, data: formattedGrades });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get grade by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const grade = db.prepare(`
      SELECT id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
             type, teacher_id, notes, created_at
      FROM grades
      WHERE id = ?
    `).get(id) as any;

    if (!grade) {
      return res.status(404).json({ success: false, error: 'Grade not found' });
    }

    // Check permissions
    if (req.userRole === 'student' && grade.student_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    res.json({
      success: true,
      data: {
        id: grade.id,
        studentId: grade.student_id,
        subjectId: grade.subject_id,
        assignmentId: grade.assignment_id,
        quizId: grade.quiz_id,
        score: grade.score,
        maxScore: grade.max_score,
        type: grade.type,
        teacherId: grade.teacher_id,
        notes: grade.notes,
        createdAt: new Date(grade.created_at),
      },
    });
  } catch (error) {
    console.error('Get grade error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create grade
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId, subjectId, assignmentId, quizId, score, maxScore, type, notes } = req.body;

    if (!studentId || !subjectId || !score || !maxScore || !type) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Only teachers and admins can create grades
    if (req.userRole !== 'teacher' && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO grades (id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
                         type, teacher_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      id,
      studentId,
      subjectId,
      assignmentId || null,
      quizId || null,
      score,
      maxScore,
      type,
      req.userId,
      notes || null
    );

    const grade = db.prepare(`
      SELECT id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
             type, teacher_id, notes, created_at
      FROM grades
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: grade.id,
        studentId: grade.student_id,
        subjectId: grade.subject_id,
        assignmentId: grade.assignment_id,
        quizId: grade.quiz_id,
        score: grade.score,
        maxScore: grade.max_score,
        type: grade.type,
        teacherId: grade.teacher_id,
        notes: grade.notes,
        createdAt: new Date(grade.created_at),
      },
    });
  } catch (error) {
    console.error('Create grade error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update grade
router.put('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { score, maxScore, notes } = req.body;

    const grade = db.prepare('SELECT teacher_id FROM grades WHERE id = ?').get(id) as any;
    if (!grade) {
      return res.status(404).json({ success: false, error: 'Grade not found' });
    }

    // Only teacher who created or admin can update
    if (grade.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (score !== undefined) { updates.push('score = ?'); values.push(score); }
    if (maxScore !== undefined) { updates.push('max_score = ?'); values.push(maxScore); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE grades SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedGrade = db.prepare(`
      SELECT id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
             type, teacher_id, notes, created_at
      FROM grades
      WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: updatedGrade.id,
        studentId: updatedGrade.student_id,
        subjectId: updatedGrade.subject_id,
        assignmentId: updatedGrade.assignment_id,
        quizId: updatedGrade.quiz_id,
        score: updatedGrade.score,
        maxScore: updatedGrade.max_score,
        type: updatedGrade.type,
        teacherId: updatedGrade.teacher_id,
        notes: updatedGrade.notes,
        createdAt: new Date(updatedGrade.created_at),
      },
    });
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete grade
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const grade = db.prepare('SELECT teacher_id FROM grades WHERE id = ?').get(id) as any;
    if (!grade) {
      return res.status(404).json({ success: false, error: 'Grade not found' });
    }

    // Only teacher who created or admin can delete
    if (grade.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM grades WHERE id = ?').run(id);

    res.json({ success: true, message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get report card
router.get('/report-card/:studentId', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { studentId } = req.params;
    const { academicYear, semester } = req.query;

    // Check permissions
    if (req.userRole === 'student' && req.userId !== studentId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (req.userRole === 'parent') {
      const user = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.student_id !== studentId) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    // Get student's class
    const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(studentId) as any;
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }

    // Get grades
    let gradesQuery = `
      SELECT id, student_id, subject_id, assignment_id, quiz_id, score, max_score,
             type, teacher_id, notes, created_at
      FROM grades
      WHERE student_id = ?
    `;
    
    const params: any[] = [studentId];
    
    // Filter by academic year and semester if provided
    // Note: This is simplified - you might want to add academic_year and semester to grades table
    const grades = db.prepare(gradesQuery).all(...params) as any[];

    // Calculate average
    const totalScore = grades.reduce((sum, g) => sum + g.score, 0);
    const totalMaxScore = grades.reduce((sum, g) => sum + g.max_score, 0);
    const averageScore = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

    // Get report card if exists
    const reportCard = db.prepare(`
      SELECT id, student_id, class_id, academic_year, semester, average_score, rank, teacher_notes, created_at
      FROM report_cards
      WHERE student_id = ? AND academic_year = ? AND semester = ?
    `).get(studentId, academicYear || '2024/2025', semester || 1) as any;

    const formattedGrades = grades.map(grade => ({
      id: grade.id,
      studentId: grade.student_id,
      subjectId: grade.subject_id,
      assignmentId: grade.assignment_id,
      quizId: grade.quiz_id,
      score: grade.score,
      maxScore: grade.max_score,
      type: grade.type,
      teacherId: grade.teacher_id,
      notes: grade.notes,
      createdAt: new Date(grade.created_at),
    }));

    res.json({
      success: true,
      data: {
        id: reportCard?.id || crypto.randomUUID(),
        studentId,
        classId: student.class_id,
        academicYear: academicYear || '2024/2025',
        semester: semester || 1,
        grades: formattedGrades,
        averageScore,
        rank: reportCard?.rank,
        teacherNotes: reportCard?.teacher_notes,
        createdAt: reportCard ? new Date(reportCard.created_at) : new Date(),
      },
    });
  } catch (error) {
    console.error('Get report card error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
