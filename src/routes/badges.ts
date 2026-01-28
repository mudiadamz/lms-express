import express from 'express';
import db from '../database/db.js';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all badge counts for current user
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const badges: Record<string, number> = {};
    const now = new Date().toISOString();

    if (req.userRole === 'student') {
      // Count pending assignments
      const assignments = db.prepare(`
        SELECT a.id, a.due_date,
               (SELECT score FROM assignment_submissions WHERE assignment_id = a.id AND student_id = ?) as score,
               (SELECT id FROM assignment_submissions WHERE assignment_id = a.id AND student_id = ?) as submission_id
        FROM assignments a
        WHERE a.class_id = (SELECT class_id FROM users WHERE id = ?)
      `).all(req.userId, req.userId, req.userId) as any[];

      badges.assignments = assignments.filter(a => 
        !a.submission_id && 
        !a.score && 
        a.due_date >= now
      ).length;

      // Count active quizzes
      const quizzes = db.prepare(`
        SELECT q.id, q.start_date, q.end_date,
               (SELECT score FROM quiz_submissions WHERE quiz_id = q.id AND student_id = ?) as score,
               (SELECT id FROM quiz_submissions WHERE quiz_id = q.id AND student_id = ?) as submission_id
        FROM quizzes q
        WHERE q.class_id = (SELECT class_id FROM users WHERE id = ?)
      `).all(req.userId, req.userId, req.userId) as any[];

      badges.quizzes = quizzes.filter(q => 
        !q.submission_id && 
        !q.score && 
        q.start_date <= now && 
        q.end_date >= now
      ).length;

      // Count unpaid payments
      const payments = db.prepare(`
        SELECT COUNT(*) as count FROM payments 
        WHERE student_id = ? AND status IN ('pending', 'overdue', 'verifying')
      `).get(req.userId) as any;

      badges.payments = payments?.count || 0;

    } else if (req.userRole === 'teacher') {
      // Count ungraded submissions
      const ungraded = db.prepare(`
        SELECT COUNT(*) as count
        FROM assignment_submissions s
        JOIN assignments a ON s.assignment_id = a.id
        WHERE a.teacher_id = ? AND s.score IS NULL
      `).get(req.userId) as any;

      badges.grading = ungraded?.count || 0;

    } else if (req.userRole === 'admin') {
      // Count payments needing verification
      const verifying = db.prepare(`
        SELECT COUNT(*) as count FROM payments WHERE status = 'verifying'
      `).get() as any;

      badges.payments = verifying?.count || 0;
    }

    // Count unread notifications (all roles)
    const unread = db.prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = 0
    `).get(req.userId) as any;

    badges.notifications = unread?.count || 0;

    res.json({ success: true, data: badges });
  } catch (error) {
    console.error('Get badges error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
