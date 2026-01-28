import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get quizzes
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, subjectId, teacherId } = req.query;
    let query = `
      SELECT q.id, q.title, q.description, q.subject_id, q.class_id, q.teacher_id,
             q.time_limit, q.start_date, q.end_date, q.max_score, q.created_at,
             u.full_name as teacher_name
      FROM quizzes q
      LEFT JOIN users u ON q.teacher_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (classId) {
      query += ' AND q.class_id = ?';
      params.push(classId);
    }
    
    if (subjectId) {
      query += ' AND q.subject_id = ?';
      params.push(subjectId);
    }

    if (teacherId) {
      query += ' AND q.teacher_id = ?';
      params.push(teacherId);
    }
    
    if (req.userRole === 'student') {
      const user = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.class_id) {
        query += ' AND q.class_id = ?';
        params.push(user.class_id);
      }
    }
    
    query += ' ORDER BY q.created_at DESC';

    const quizzes = db.prepare(query).all(...params) as any[];

    const formattedQuizzes = quizzes.map(quiz => {
      const questions = db.prepare(`
        SELECT id, question, question_image, type, options, correct_answer, points, question_order
        FROM quiz_questions
        WHERE quiz_id = ?
        ORDER BY question_order
      `).all(quiz.id) as any[];

      // For students, include their submission status
      let submission = null;
      if (req.userRole === 'student') {
        submission = db.prepare(`
          SELECT id, score, submitted_at, graded_at
          FROM quiz_submissions
          WHERE quiz_id = ? AND student_id = ?
        `).get(quiz.id, req.userId) as any;
      }

      // For teachers, include submission counts
      let submissionCount = 0;
      let ungradedCount = 0;
      let totalStudents = 0;
      if (req.userRole === 'teacher') {
        // Count total submissions
        const submissionCountResult = db.prepare(`
          SELECT COUNT(*) as count FROM quiz_submissions WHERE quiz_id = ?
        `).get(quiz.id) as any;
        submissionCount = submissionCountResult?.count || 0;

        // Count ungraded submissions (score is null)
        const ungradedCountResult = db.prepare(`
          SELECT COUNT(*) as count FROM quiz_submissions WHERE quiz_id = ? AND score IS NULL
        `).get(quiz.id) as any;
        ungradedCount = ungradedCountResult?.count || 0;

        // Count total students in class
        const totalStudentsResult = db.prepare(`
          SELECT COUNT(DISTINCT u.id) as count
          FROM users u
          LEFT JOIN class_students cs ON cs.student_id = u.id
          WHERE u.role = 'student' AND (u.class_id = ? OR cs.class_id = ?)
        `).get(quiz.class_id, quiz.class_id) as any;
        totalStudents = totalStudentsResult?.count || 0;
      }

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        subjectId: quiz.subject_id,
        classId: quiz.class_id,
        teacherId: quiz.teacher_id,
        teacherName: quiz.teacher_name,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          questionImage: q.question_image || undefined,
          type: q.type,
          options: q.options ? JSON.parse(q.options) : undefined,
          correctAnswer: q.correct_answer,
          points: q.points,
        })),
        timeLimit: quiz.time_limit,
        startDate: new Date(quiz.start_date),
        endDate: new Date(quiz.end_date),
        maxScore: quiz.max_score,
        status: submission ? 'submitted' : 'pending',
        score: submission?.score || null,
        submittedAt: submission?.submitted_at ? new Date(submission.submitted_at) : null,
        submissionCount: submissionCount,
        ungradedCount: ungradedCount,
        totalStudents: totalStudents,
        createdAt: new Date(quiz.created_at),
      };
    });

    res.json({ success: true, data: formattedQuizzes });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get quiz by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log('Getting quiz by ID:', id, 'for user:', req.userId, 'role:', req.userRole);

    const quiz = db.prepare(`
      SELECT q.id, q.title, q.description, q.subject_id, q.class_id, q.teacher_id,
             q.time_limit, q.start_date, q.end_date, q.max_score, q.created_at,
             u.full_name as teacher_name
      FROM quizzes q
      LEFT JOIN users u ON q.teacher_id = u.id
      WHERE q.id = ?
    `).get(id) as any;

    if (!quiz) {
      console.log('Quiz not found:', id);
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    console.log('Quiz found:', quiz.title);

    const questions = db.prepare(`
      SELECT id, question, question_image, type, options, correct_answer, points, question_order
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY question_order
    `).all(id) as any[];

    // For students, check if they have submitted
    let submission = null;
    if (req.userRole === 'student') {
      try {
        submission = db.prepare(`
          SELECT id, score, submitted_at, graded_at
          FROM quiz_submissions
          WHERE quiz_id = ? AND student_id = ?
        `).get(id, req.userId) as any;
        console.log('Student submission check:', submission ? 'Found' : 'Not found');
        if (submission) {
          console.log('Submission details:', { score: submission.score, submitted_at: submission.submitted_at });
        }
      } catch (submissionError) {
        console.error('Error checking submission:', submissionError);
        submission = null;
      }
    }

    res.json({
      success: true,
      data: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        subjectId: quiz.subject_id,
        classId: quiz.class_id,
        teacherId: quiz.teacher_id,
        teacherName: quiz.teacher_name,
        questions: questions.map(q => ({
          id: q.id,
          question: q.question,
          questionImage: q.question_image || undefined,
          type: q.type,
          options: q.options ? JSON.parse(q.options) : undefined,
          correctAnswer: q.correct_answer,
          points: q.points,
        })),
        timeLimit: quiz.time_limit,
        startDate: new Date(quiz.start_date),
        endDate: new Date(quiz.end_date),
        maxScore: quiz.max_score,
        status: submission ? 'submitted' : 'not_submitted',
        score: submission?.score !== null && submission?.score !== undefined ? submission.score : null,
        submittedAt: submission?.submitted_at ? new Date(submission.submitted_at) : null,
        gradedAt: submission?.graded_at ? new Date(submission.graded_at) : null,
        createdAt: new Date(quiz.created_at),
      },
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create quiz
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { title, description, subjectId, classId, questions, timeLimit, startDate, endDate, maxScore } = req.body;

    // Detailed validation
    const missingFields: string[] = [];
    if (!title) missingFields.push('title');
    if (!description) missingFields.push('description');
    if (!subjectId) missingFields.push('subjectId');
    if (!classId) missingFields.push('classId');
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      missingFields.push('questions (minimal 1 pertanyaan)');
    }
    if (!startDate) missingFields.push('startDate');
    if (!endDate) missingFields.push('endDate');
    if (!maxScore) missingFields.push('maxScore');

    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Field yang wajib diisi: ${missingFields.join(', ')}` 
      });
    }

    const id = crypto.randomUUID();
    const teacherId = req.userId!;

    db.prepare(`
      INSERT INTO quizzes (id, title, description, subject_id, class_id, teacher_id,
                           time_limit, start_date, end_date, max_score, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, title, description, subjectId, classId, teacherId, timeLimit || null, startDate, endDate, maxScore);

    // Insert questions
    const insertQuestion = db.prepare(`
      INSERT INTO quiz_questions (id, quiz_id, question, question_image, type, options, correct_answer, points, question_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    questions.forEach((q: any, index: number) => {
      const questionId = crypto.randomUUID();
      insertQuestion.run(
        questionId,
        id,
        q.question,
        q.questionImage || null,
        q.type,
        q.options ? JSON.stringify(q.options) : null,
        typeof q.correctAnswer === 'object' ? JSON.stringify(q.correctAnswer) : q.correctAnswer,
        q.points,
        index + 1
      );
    });

    const quiz = db.prepare(`
      SELECT id, title, description, subject_id, class_id, teacher_id,
             time_limit, start_date, end_date, max_score, created_at
      FROM quizzes
      WHERE id = ?
    `).get(id) as any;

    const quizQuestions = db.prepare(`
      SELECT id, question, question_image, type, options, correct_answer, points, question_order
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY question_order
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        subjectId: quiz.subject_id,
        classId: quiz.class_id,
        teacherId: quiz.teacher_id,
        questions: quizQuestions.map(q => ({
          id: q.id,
          question: q.question,
          questionImage: q.question_image || undefined,
          type: q.type,
          options: q.options ? JSON.parse(q.options) : undefined,
          correctAnswer: q.correct_answer,
          points: q.points,
        })),
        timeLimit: quiz.time_limit,
        startDate: new Date(quiz.start_date),
        endDate: new Date(quiz.end_date),
        maxScore: quiz.max_score,
        createdAt: new Date(quiz.created_at),
      },
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Submit quiz
router.post('/:id/submit', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id: quizId } = req.params;
    const { answers } = req.body;

    if (!answers) {
      return res.status(400).json({ success: false, error: 'Answers required' });
    }

    // Check if quiz exists
    const quiz = db.prepare('SELECT id, end_date FROM quizzes WHERE id = ?').get(quizId) as any;
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Check if already submitted - quizzes cannot be resubmitted
    const existingSubmission = db.prepare(`
      SELECT id FROM quiz_submissions WHERE quiz_id = ? AND student_id = ?
    `).get(quizId, req.userId);

    if (existingSubmission) {
      return res.status(400).json({ success: false, error: 'Quiz already submitted' });
    }

    const submissionId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO quiz_submissions (id, quiz_id, student_id, submitted_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(submissionId, quizId, req.userId);

    // Insert answers
    const insertAnswer = db.prepare(`
      INSERT INTO quiz_answers (id, submission_id, question_id, answer)
      VALUES (?, ?, ?, ?)
    `);

    for (const [questionId, answer] of Object.entries(answers)) {
      const answerId = crypto.randomUUID();
      const answerValue = typeof answer === 'object' ? JSON.stringify(answer) : String(answer);
      insertAnswer.run(answerId, submissionId, questionId, answerValue);
    }

    // Auto-grade multiple choice questions
    const questions = db.prepare(`
      SELECT id, type, correct_answer, points
      FROM quiz_questions
      WHERE quiz_id = ?
    `).all(quizId) as any[];

    let totalScore = 0;
    for (const question of questions) {
      const studentAnswer = answers[question.id];
      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        if (String(studentAnswer) === String(question.correct_answer)) {
          totalScore += question.points;
        }
      }
    }

    db.prepare(`
      UPDATE quiz_submissions
      SET score = ?, graded_at = datetime('now')
      WHERE id = ?
    `).run(totalScore, submissionId);

    // Create grade record
    const quizInfo = db.prepare('SELECT subject_id, max_score FROM quizzes WHERE id = ?').get(quizId) as any;
    const gradeId = crypto.randomUUID();
    db.prepare(`
      INSERT OR REPLACE INTO grades (id, student_id, subject_id, quiz_id, score, max_score,
                                     type, teacher_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'quiz', ?, datetime('now'))
    `).run(
      gradeId,
      req.userId,
      quizInfo.subject_id,
      quizId,
      totalScore,
      quizInfo.max_score,
      req.userId // Will be updated by teacher if needed
    );

    const submission = db.prepare(`
      SELECT id, quiz_id, student_id, score, submitted_at, graded_at
      FROM quiz_submissions
      WHERE id = ?
    `).get(submissionId) as any;

    const submissionAnswers = db.prepare(`
      SELECT question_id, answer FROM quiz_answers WHERE submission_id = ?
    `).all(submissionId) as any[];

    const answersObj: Record<string, string | string[]> = {};
    for (const ans of submissionAnswers) {
      try {
        answersObj[ans.question_id] = JSON.parse(ans.answer);
      } catch {
        answersObj[ans.question_id] = ans.answer;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: submission.id,
        quizId: submission.quiz_id,
        studentId: submission.student_id,
        answers: answersObj,
        score: submission.score,
        submittedAt: new Date(submission.submitted_at),
        gradedAt: submission.graded_at ? new Date(submission.graded_at) : undefined,
      },
    });
  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get quiz submissions
router.get('/:id/submissions', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id: quizId } = req.params;

    // Check if quiz exists
    const quiz = db.prepare('SELECT id, teacher_id, class_id FROM quizzes WHERE id = ?').get(quizId) as any;
    if (!quiz) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Get all submissions for this quiz
    const submissions = db.prepare(`
      SELECT id, quiz_id, student_id, score, submitted_at, graded_at
      FROM quiz_submissions
      WHERE quiz_id = ?
    `).all(quizId) as any[];

    // For each submission, get the answers
    const submissionsWithAnswers = submissions.map(submission => {
      const answers = db.prepare(`
        SELECT question_id, answer FROM quiz_answers WHERE submission_id = ?
      `).all(submission.id) as any[];

      return {
        id: submission.id,
        quizId: submission.quiz_id,
        studentId: submission.student_id,
        answers: answers.map(a => ({
          questionId: a.question_id,
          answer: a.answer,
        })),
        score: submission.score,
        submittedAt: new Date(submission.submitted_at),
        gradedAt: submission.graded_at ? new Date(submission.graded_at) : null,
      };
    });

    res.json({ success: true, data: submissionsWithAnswers });
  } catch (error) {
    console.error('Get quiz submissions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
