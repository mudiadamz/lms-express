import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get assignments
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, subjectId } = req.query;
    let query = `
      SELECT a.id, a.title, a.description, a.subject_id, a.class_id, a.teacher_id,
             a.due_date, a.max_score, a.created_at, a.updated_at,
             u.full_name as teacher_name
      FROM assignments a
      LEFT JOIN users u ON a.teacher_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (classId) {
      query += ' AND a.class_id = ?';
      params.push(classId);
    }
    
    if (subjectId) {
      query += ' AND a.subject_id = ?';
      params.push(subjectId);
    }
    
    // Students can only see assignments for their class
    if (req.userRole === 'student') {
      const user = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.class_id) {
        query += ' AND a.class_id = ?';
        params.push(user.class_id);
      }
    }
    
    query += ' ORDER BY a.created_at DESC';

    const assignments = db.prepare(query).all(...params) as any[];

    // Get attachments for each assignment
    const formattedAssignments = assignments.map(assignment => {
      const attachments = db.prepare(`
        SELECT file_url, file_name FROM assignment_attachments WHERE assignment_id = ?
      `).all(assignment.id) as any[];

      return {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        teacherId: assignment.teacher_id,
        teacherName: assignment.teacher_name,
        dueDate: new Date(assignment.due_date),
        maxScore: assignment.max_score,
        attachments: attachments.map(a => a.file_url),
        createdAt: new Date(assignment.created_at),
        updatedAt: new Date(assignment.updated_at),
      };
    });

    res.json({ success: true, data: formattedAssignments });
  } catch (error) {
    console.error('Get assignments error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get assignment by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const assignment = db.prepare(`
      SELECT a.id, a.title, a.description, a.subject_id, a.class_id, a.teacher_id,
             a.due_date, a.max_score, a.created_at, a.updated_at,
             u.full_name as teacher_name
      FROM assignments a
      LEFT JOIN users u ON a.teacher_id = u.id
      WHERE a.id = ?
    `).get(id) as any;

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    const attachments = db.prepare(`
      SELECT file_url, file_name FROM assignment_attachments WHERE assignment_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        teacherId: assignment.teacher_id,
        teacherName: assignment.teacher_name,
        dueDate: new Date(assignment.due_date),
        maxScore: assignment.max_score,
        attachments: attachments.map(a => a.file_url),
        createdAt: new Date(assignment.created_at),
        updatedAt: new Date(assignment.updated_at),
      },
    });
  } catch (error) {
    console.error('Get assignment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create assignment
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { title, description, subjectId, classId, dueDate, maxScore, attachments } = req.body;

    if (!title || !description || !subjectId || !classId || !dueDate || !maxScore) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const id = crypto.randomUUID();
    const teacherId = req.userId!;

    db.prepare(`
      INSERT INTO assignments (id, title, description, subject_id, class_id, teacher_id,
                              due_date, max_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, title, description, subjectId, classId, teacherId, dueDate, maxScore);

    // Insert attachments
    if (attachments && Array.isArray(attachments)) {
      const insertAttachment = db.prepare(`
        INSERT INTO assignment_attachments (id, assignment_id, file_url, file_name)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const attachment of attachments) {
        const attachmentId = crypto.randomUUID();
        insertAttachment.run(attachmentId, id, attachment.url || attachment, attachment.name || attachment);
      }
    }

    const assignment = db.prepare(`
      SELECT id, title, description, subject_id, class_id, teacher_id,
             due_date, max_score, created_at, updated_at
      FROM assignments
      WHERE id = ?
    `).get(id) as any;

    const assignmentAttachments = db.prepare(`
      SELECT file_url FROM assignment_attachments WHERE assignment_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        subjectId: assignment.subject_id,
        classId: assignment.class_id,
        teacherId: assignment.teacher_id,
        dueDate: new Date(assignment.due_date),
        maxScore: assignment.max_score,
        attachments: assignmentAttachments.map(a => a.file_url),
        createdAt: new Date(assignment.created_at),
        updatedAt: new Date(assignment.updated_at),
      },
    });
  } catch (error) {
    console.error('Create assignment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update assignment
router.put('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, subjectId, classId, dueDate, maxScore, attachments } = req.body;

    // Check if assignment exists and user is the teacher
    const assignment = db.prepare('SELECT teacher_id FROM assignments WHERE id = ?').get(id) as any;
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    if (assignment.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (subjectId !== undefined) { updates.push('subject_id = ?'); values.push(subjectId); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (dueDate !== undefined) { updates.push('due_date = ?'); values.push(dueDate); }
    if (maxScore !== undefined) { updates.push('max_score = ?'); values.push(maxScore); }
    
    updates.push('updated_at = datetime(\'now\')');
    values.push(id);

    db.prepare(`UPDATE assignments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Update attachments if provided
    if (attachments !== undefined) {
      db.prepare('DELETE FROM assignment_attachments WHERE assignment_id = ?').run(id);
      
      if (Array.isArray(attachments) && attachments.length > 0) {
        const insertAttachment = db.prepare(`
          INSERT INTO assignment_attachments (id, assignment_id, file_url, file_name)
          VALUES (?, ?, ?, ?)
        `);
        
        for (const attachment of attachments) {
          const attachmentId = crypto.randomUUID();
          insertAttachment.run(attachmentId, id, attachment.url || attachment, attachment.name || attachment);
        }
      }
    }

    const updatedAssignment = db.prepare(`
      SELECT id, title, description, subject_id, class_id, teacher_id,
             due_date, max_score, created_at, updated_at
      FROM assignments
      WHERE id = ?
    `).get(id) as any;

    const assignmentAttachments = db.prepare(`
      SELECT file_url FROM assignment_attachments WHERE assignment_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: updatedAssignment.id,
        title: updatedAssignment.title,
        description: updatedAssignment.description,
        subjectId: updatedAssignment.subject_id,
        classId: updatedAssignment.class_id,
        teacherId: updatedAssignment.teacher_id,
        dueDate: new Date(updatedAssignment.due_date),
        maxScore: updatedAssignment.max_score,
        attachments: assignmentAttachments.map(a => a.file_url),
        createdAt: new Date(updatedAssignment.created_at),
        updatedAt: new Date(updatedAssignment.updated_at),
      },
    });
  } catch (error) {
    console.error('Update assignment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete assignment
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const assignment = db.prepare('SELECT teacher_id FROM assignments WHERE id = ?').get(id) as any;
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    if (assignment.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);

    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Delete assignment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Submit assignment
router.post('/:id/submissions', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id: assignmentId } = req.params;
    const { content, attachments } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content required' });
    }

    // Check if assignment exists
    const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Check if already submitted
    const existingSubmission = db.prepare(`
      SELECT id FROM assignment_submissions WHERE assignment_id = ? AND student_id = ?
    `).get(assignmentId, req.userId);

    if (existingSubmission) {
      return res.status(400).json({ success: false, error: 'Assignment already submitted' });
    }

    const submissionId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO assignment_submissions (id, assignment_id, student_id, content, submitted_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(submissionId, assignmentId, req.userId, content);

    // Insert attachments
    if (attachments && Array.isArray(attachments)) {
      const insertAttachment = db.prepare(`
        INSERT INTO submission_attachments (id, submission_id, file_url, file_name)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const attachment of attachments) {
        const attachmentId = crypto.randomUUID();
        insertAttachment.run(attachmentId, submissionId, attachment.url || attachment, attachment.name || attachment);
      }
    }

    const submission = db.prepare(`
      SELECT id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at
      FROM assignment_submissions
      WHERE id = ?
    `).get(submissionId) as any;

    const submissionAttachments = db.prepare(`
      SELECT file_url FROM submission_attachments WHERE submission_id = ?
    `).all(submissionId) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: submission.id,
        assignmentId: submission.assignment_id,
        studentId: submission.student_id,
        content: submission.content,
        score: submission.score,
        feedback: submission.feedback,
        attachments: submissionAttachments.map(a => a.file_url),
        submittedAt: new Date(submission.submitted_at),
        gradedAt: submission.graded_at ? new Date(submission.graded_at) : undefined,
      },
    });
  } catch (error) {
    console.error('Submit assignment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get submissions for an assignment
router.get('/:id/submissions', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id: assignmentId } = req.params;

    // Check if assignment exists
    const assignment = db.prepare('SELECT teacher_id, class_id FROM assignments WHERE id = ?').get(assignmentId) as any;
    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Students can only see their own submissions
    // Teachers can see all submissions for their assignment
    let query = `
      SELECT id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at
      FROM assignment_submissions
      WHERE assignment_id = ?
    `;
    
    const params: any[] = [assignmentId];
    
    if (req.userRole === 'student') {
      query += ' AND student_id = ?';
      params.push(req.userId);
    } else if (req.userRole === 'teacher') {
      // Teachers can only see submissions for their own assignments
      if (assignment.teacher_id !== req.userId) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }
    // Admins can see all submissions, no additional check needed

    const submissions = db.prepare(query).all(...params) as any[];

    const formattedSubmissions = submissions.map(submission => {
      const attachments = db.prepare(`
        SELECT file_url FROM submission_attachments WHERE submission_id = ?
      `).all(submission.id) as any[];

      return {
        id: submission.id,
        assignmentId: submission.assignment_id,
        studentId: submission.student_id,
        content: submission.content,
        score: submission.score,
        feedback: submission.feedback,
        attachments: attachments.map(a => a.file_url),
        submittedAt: new Date(submission.submitted_at),
        gradedAt: submission.graded_at ? new Date(submission.graded_at) : undefined,
      };
    });

    res.json({ success: true, data: formattedSubmissions });
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Grade submission
router.patch('/submissions/:submissionId', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined) {
      return res.status(400).json({ success: false, error: 'Score required' });
    }

    // Check if submission exists and get assignment info
    const submission = db.prepare(`
      SELECT s.id, s.assignment_id, a.teacher_id, a.max_score
      FROM assignment_submissions s
      JOIN assignments a ON s.assignment_id = a.id
      WHERE s.id = ?
    `).get(submissionId) as any;

    if (!submission) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    // Only teacher or admin can grade
    if (submission.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    // Validate score
    if (score < 0 || score > submission.max_score) {
      return res.status(400).json({ success: false, error: 'Invalid score' });
    }

    db.prepare(`
      UPDATE assignment_submissions
      SET score = ?, feedback = ?, graded_at = datetime('now')
      WHERE id = ?
    `).run(score, feedback || null, submissionId);

    // Create grade record
    const student = db.prepare(`
      SELECT student_id FROM assignment_submissions WHERE id = ?
    `).get(submissionId) as any;

    const assignment = db.prepare(`
      SELECT subject_id, max_score FROM assignments WHERE id = ?
    `).get(submission.assignment_id) as any;

    const gradeId = crypto.randomUUID();
    db.prepare(`
      INSERT OR REPLACE INTO grades (id, student_id, subject_id, assignment_id, score, max_score,
                                     type, teacher_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'assignment', ?, ?, datetime('now'))
    `).run(
      gradeId,
      student.student_id,
      assignment.subject_id,
      submission.assignment_id,
      score,
      assignment.max_score,
      req.userId,
      feedback || null
    );

    const updatedSubmission = db.prepare(`
      SELECT id, assignment_id, student_id, content, score, feedback, submitted_at, graded_at
      FROM assignment_submissions
      WHERE id = ?
    `).get(submissionId) as any;

    const attachments = db.prepare(`
      SELECT file_url FROM submission_attachments WHERE submission_id = ?
    `).all(submissionId) as any[];

    res.json({
      success: true,
      data: {
        id: updatedSubmission.id,
        assignmentId: updatedSubmission.assignment_id,
        studentId: updatedSubmission.student_id,
        content: updatedSubmission.content,
        score: updatedSubmission.score,
        feedback: updatedSubmission.feedback,
        attachments: attachments.map(a => a.file_url),
        submittedAt: new Date(updatedSubmission.submitted_at),
        gradedAt: updatedSubmission.graded_at ? new Date(updatedSubmission.graded_at) : undefined,
      },
    });
  } catch (error) {
    console.error('Grade submission error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
