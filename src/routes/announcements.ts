import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all announcements
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, targetAudience, isPinned } = req.query;

    let query = `
      SELECT a.id, a.title, a.content, a.author_id, a.target_audience, a.class_id, 
             a.is_pinned, a.start_date, a.end_date, a.created_at,
             u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE 1=1
    `;

    const params: any[] = [];

    // Filter by target audience
    if (targetAudience) {
      query += ' AND (a.target_audience = ? OR a.target_audience = \'all\')';
      params.push(targetAudience);
    }

    if (classId) {
      query += ' AND (a.class_id = ? OR a.class_id IS NULL)';
      params.push(classId);
    }

    if (isPinned !== undefined) {
      query += ' AND a.is_pinned = ?';
      params.push(isPinned === 'true' || isPinned === '1' ? 1 : 0);
    }

    // Students can only see announcements for their class or all
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id) {
        query += ' AND (a.class_id = ? OR a.class_id IS NULL)';
        params.push(student.class_id);
      } else {
        query += ' AND a.class_id IS NULL';
      }
      query += ' AND (a.target_audience = ? OR a.target_audience = \'all\')';
      params.push(req.userRole);
    }

    // Parents can see announcements for their child's class
    if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id) {
        const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(parent.student_id) as any;
        if (student?.class_id) {
          query += ' AND (a.class_id = ? OR a.class_id IS NULL)';
          params.push(student.class_id);
        }
      }
      query += ' AND (a.target_audience = ? OR a.target_audience = \'all\')';
      params.push('parent');
    }

    // Filter by date (only show active announcements)
    // Admin and teachers can see all announcements regardless of date
    if (req.userRole !== 'admin' && req.userRole !== 'teacher') {
      query += ' AND (a.end_date IS NULL OR a.end_date >= date(\'now\'))';
      query += ' AND a.start_date <= date(\'now\')';
    }

    query += ' ORDER BY a.is_pinned DESC, a.created_at DESC';

    const announcements = db.prepare(query).all(...params) as any[];

    // Get attachments for each announcement
    const announcementsWithAttachments = announcements.map(announcement => {
      const attachments = db.prepare(`
        SELECT id, file_url, file_name FROM announcement_attachments WHERE announcement_id = ?
      `).all(announcement.id) as any[];

      return {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        authorId: announcement.author_id,
        authorName: announcement.author_name,
        targetAudience: announcement.target_audience,
        classId: announcement.class_id,
        isPinned: announcement.is_pinned === 1,
        startDate: new Date(announcement.start_date),
        endDate: announcement.end_date ? new Date(announcement.end_date) : null,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(announcement.created_at),
      };
    });

    res.json({ success: true, data: announcementsWithAttachments });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get announcement by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const announcement = db.prepare(`
      SELECT a.id, a.title, a.content, a.author_id, a.target_audience, a.class_id, 
             a.is_pinned, a.start_date, a.end_date, a.created_at,
             u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `).get(id) as any;

    if (!announcement) {
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (announcement.class_id && student?.class_id !== announcement.class_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
      if (announcement.target_audience !== 'all' && announcement.target_audience !== req.userRole) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const attachments = db.prepare(`
      SELECT id, file_url, file_name FROM announcement_attachments WHERE announcement_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        authorId: announcement.author_id,
        authorName: announcement.author_name,
        targetAudience: announcement.target_audience,
        classId: announcement.class_id,
        isPinned: announcement.is_pinned === 1,
        startDate: new Date(announcement.start_date),
        endDate: announcement.end_date ? new Date(announcement.end_date) : null,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(announcement.created_at),
      },
    });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create announcement (admin/teacher only)
router.post('/', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { title, content, targetAudience, classId, isPinned, startDate, endDate, attachments } = req.body;

    if (!title || !content || !targetAudience || !startDate) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Teachers can only create announcements for their classes
    if (req.userRole === 'teacher' && classId) {
      const teacherClasses = db.prepare(`
        SELECT id FROM classes WHERE homeroom_teacher_id = ?
      `).all(req.userId) as any[];
      const classIds = teacherClasses.map(c => c.id);
      if (!classIds.includes(classId)) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO announcements (id, title, content, author_id, target_audience, class_id, is_pinned, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, content, req.userId, targetAudience, classId || null, isPinned ? 1 : 0, startDate, endDate || null);

    // Add attachments
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        if (attachment.fileUrl && attachment.fileName) {
          const attachmentId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO announcement_attachments (id, announcement_id, file_url, file_name)
            VALUES (?, ?, ?, ?)
          `).run(attachmentId, id, attachment.fileUrl, attachment.fileName);
        }
      }
    }

    // Create notifications for target users
    let targetUserIds: string[] = [];
    if (targetAudience === 'all') {
      const allUsers = db.prepare('SELECT id FROM users').all() as any[];
      targetUserIds = allUsers.map(u => u.id);
    } else if (Array.isArray(targetAudience)) {
      const users = db.prepare(`SELECT id FROM users WHERE role IN (${targetAudience.map(() => '?').join(',')})`).all(...targetAudience) as any[];
      targetUserIds = users.map(u => u.id);
    } else {
      const users = db.prepare('SELECT id FROM users WHERE role = ?').all(targetAudience) as any[];
      targetUserIds = users.map(u => u.id);
    }

    if (classId) {
      const classStudents = db.prepare('SELECT student_id FROM class_students WHERE class_id = ?').all(classId) as any[];
      const studentIds = classStudents.map(cs => cs.student_id);
      targetUserIds = [...new Set([...targetUserIds, ...studentIds])];
    }

    for (const userId of targetUserIds) {
      const notificationId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, 'announcement', ?, ?, ?)
      `).run(notificationId, userId, title, content.substring(0, 100), `/announcements/${id}`);
    }

    const announcement = db.prepare(`
      SELECT a.id, a.title, a.content, a.author_id, a.target_audience, a.class_id, 
             a.is_pinned, a.start_date, a.end_date, a.created_at,
             u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `).get(id) as any;

    const announcementAttachments = db.prepare(`
      SELECT id, file_url, file_name FROM announcement_attachments WHERE announcement_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        authorId: announcement.author_id,
        authorName: announcement.author_name,
        targetAudience: announcement.target_audience,
        classId: announcement.class_id,
        isPinned: announcement.is_pinned === 1,
        startDate: new Date(announcement.start_date),
        endDate: announcement.end_date ? new Date(announcement.end_date) : null,
        attachments: announcementAttachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(announcement.created_at),
      },
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update announcement (admin/author only)
router.put('/:id', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, content, targetAudience, classId, isPinned, startDate, endDate } = req.body;

    const existing = db.prepare('SELECT author_id FROM announcements WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }

    // Only author or admin can update
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (targetAudience !== undefined) { updates.push('target_audience = ?'); values.push(targetAudience); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (isPinned !== undefined) { updates.push('is_pinned = ?'); values.push(isPinned ? 1 : 0); }
    if (startDate !== undefined) { updates.push('start_date = ?'); values.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); values.push(endDate); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`UPDATE announcements SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const announcement = db.prepare(`
      SELECT a.id, a.title, a.content, a.author_id, a.target_audience, a.class_id, 
             a.is_pinned, a.start_date, a.end_date, a.created_at,
             u.full_name as author_name
      FROM announcements a
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.id = ?
    `).get(id) as any;

    const attachments = db.prepare(`
      SELECT id, file_url, file_name FROM announcement_attachments WHERE announcement_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        authorId: announcement.author_id,
        authorName: announcement.author_name,
        targetAudience: announcement.target_audience,
        classId: announcement.class_id,
        isPinned: announcement.is_pinned === 1,
        startDate: new Date(announcement.start_date),
        endDate: announcement.end_date ? new Date(announcement.end_date) : null,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(announcement.created_at),
      },
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete announcement (admin/author only)
router.delete('/:id', authenticateToken, requireRole('admin', 'teacher'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT author_id FROM announcements WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Announcement not found' });
    }

    // Only author or admin can delete
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
