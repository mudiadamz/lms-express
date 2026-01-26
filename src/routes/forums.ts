import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all forum posts for a class
router.get('/posts', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId } = req.query;

    if (!classId) {
      return res.status(400).json({ success: false, error: 'classId required' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id !== classId) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const posts = db.prepare(`
      SELECT id, class_id, author_id, author_name, author_role, title, content, is_pinned, created_at, updated_at
      FROM forum_posts
      WHERE class_id = ?
      ORDER BY is_pinned DESC, created_at DESC
    `).all(classId) as any[];

    // Get attachments for each post
    const postsWithAttachments = posts.map(post => {
      const attachments = db.prepare(`
        SELECT id, file_url, file_name FROM forum_post_attachments WHERE post_id = ?
      `).all(post.id) as any[];

      return {
        id: post.id,
        classId: post.class_id,
        authorId: post.author_id,
        authorName: post.author_name,
        authorRole: post.author_role,
        title: post.title,
        content: post.content,
        isPinned: post.is_pinned === 1,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(post.created_at),
        updatedAt: new Date(post.updated_at),
      };
    });

    res.json({ success: true, data: postsWithAttachments });
  } catch (error) {
    console.error('Get forum posts error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get forum post by ID
router.get('/posts/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const post = db.prepare(`
      SELECT id, class_id, author_id, author_name, author_role, title, content, is_pinned, created_at, updated_at
      FROM forum_posts
      WHERE id = ?
    `).get(id) as any;

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id !== post.class_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const attachments = db.prepare(`
      SELECT id, file_url, file_name FROM forum_post_attachments WHERE post_id = ?
    `).all(id) as any[];

    const comments = db.prepare(`
      SELECT id, author_id, author_name, author_role, content, created_at, updated_at
      FROM forum_comments
      WHERE post_id = ?
      ORDER BY created_at ASC
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: post.id,
        classId: post.class_id,
        authorId: post.author_id,
        authorName: post.author_name,
        authorRole: post.author_role,
        title: post.title,
        content: post.content,
        isPinned: post.is_pinned === 1,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        comments: comments.map(c => ({
          id: c.id,
          authorId: c.author_id,
          authorName: c.author_name,
          authorRole: c.author_role,
          content: c.content,
          createdAt: new Date(c.created_at),
          updatedAt: new Date(c.updated_at),
        })),
        createdAt: new Date(post.created_at),
        updatedAt: new Date(post.updated_at),
      },
    });
  } catch (error) {
    console.error('Get forum post error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create forum post
router.post('/posts', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, title, content, attachments, isPinned } = req.body;

    if (!classId || !title || !content) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id !== classId) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const author = db.prepare('SELECT full_name, role FROM users WHERE id = ?').get(req.userId) as any;
    if (!author) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO forum_posts (id, class_id, author_id, author_name, author_role, title, content, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, classId, req.userId, author.full_name, author.role, title, content, isPinned ? 1 : 0);

    // Add attachments
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        if (attachment.fileUrl && attachment.fileName) {
          const attachmentId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO forum_post_attachments (id, post_id, file_url, file_name)
            VALUES (?, ?, ?, ?)
          `).run(attachmentId, id, attachment.fileUrl, attachment.fileName);
        }
      }
    }

    const post = db.prepare(`
      SELECT id, class_id, author_id, author_name, author_role, title, content, is_pinned, created_at, updated_at
      FROM forum_posts WHERE id = ?
    `).get(id) as any;

    const postAttachments = db.prepare(`
      SELECT id, file_url, file_name FROM forum_post_attachments WHERE post_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: post.id,
        classId: post.class_id,
        authorId: post.author_id,
        authorName: post.author_name,
        authorRole: post.author_role,
        title: post.title,
        content: post.content,
        isPinned: post.is_pinned === 1,
        attachments: postAttachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(post.created_at),
        updatedAt: new Date(post.updated_at),
      },
    });
  } catch (error) {
    console.error('Create forum post error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update forum post
router.put('/posts/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, content, isPinned } = req.body;

    const existing = db.prepare('SELECT author_id FROM forum_posts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Only author can update
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (isPinned !== undefined) { updates.push('is_pinned = ?'); values.push(isPinned ? 1 : 0); }

    if (updates.length > 0) {
      updates.push('updated_at = datetime(\'now\')');
      values.push(id);
      db.prepare(`UPDATE forum_posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const post = db.prepare(`
      SELECT id, class_id, author_id, author_name, author_role, title, content, is_pinned, created_at, updated_at
      FROM forum_posts WHERE id = ?
    `).get(id) as any;

    const attachments = db.prepare(`
      SELECT id, file_url, file_name FROM forum_post_attachments WHERE post_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: post.id,
        classId: post.class_id,
        authorId: post.author_id,
        authorName: post.author_name,
        authorRole: post.author_role,
        title: post.title,
        content: post.content,
        isPinned: post.is_pinned === 1,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(post.created_at),
        updatedAt: new Date(post.updated_at),
      },
    });
  } catch (error) {
    console.error('Update forum post error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete forum post
router.delete('/posts/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT author_id FROM forum_posts WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Only author or admin can delete
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM forum_posts WHERE id = ?').run(id);

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Delete forum post error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Add comment to post
router.post('/posts/:id/comments', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id: postId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: 'Content required' });
    }

    const post = db.prepare('SELECT class_id FROM forum_posts WHERE id = ?').get(postId) as any;
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      const student = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (student?.class_id !== post.class_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    const author = db.prepare('SELECT full_name, role FROM users WHERE id = ?').get(req.userId) as any;
    const commentId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO forum_comments (id, post_id, author_id, author_name, author_role, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(commentId, postId, req.userId, author.full_name, author.role, content);

    const comment = db.prepare(`
      SELECT id, author_id, author_name, author_role, content, created_at, updated_at
      FROM forum_comments WHERE id = ?
    `).get(commentId) as any;

    res.status(201).json({
      success: true,
      data: {
        id: comment.id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        authorRole: comment.author_role,
        content: comment.content,
        createdAt: new Date(comment.created_at),
        updatedAt: new Date(comment.updated_at),
      },
    });
  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update comment
router.put('/comments/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    const existing = db.prepare('SELECT author_id FROM forum_comments WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Only author can update
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (content !== undefined) {
      db.prepare('UPDATE forum_comments SET content = ?, updated_at = datetime(\'now\') WHERE id = ?').run(content, id);
    }

    const comment = db.prepare(`
      SELECT id, author_id, author_name, author_role, content, created_at, updated_at
      FROM forum_comments WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: comment.id,
        authorId: comment.author_id,
        authorName: comment.author_name,
        authorRole: comment.author_role,
        content: comment.content,
        createdAt: new Date(comment.created_at),
        updatedAt: new Date(comment.updated_at),
      },
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete comment
router.delete('/comments/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT author_id FROM forum_comments WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    // Only author or admin can delete
    if (existing.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM forum_comments WHERE id = ?').run(id);

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
