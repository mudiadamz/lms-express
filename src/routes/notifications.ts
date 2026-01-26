import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all notifications for current user
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { isRead, limit = '50', offset = '0' } = req.query;

    let query = `
      SELECT id, user_id, type, title, message, link, is_read, created_at
      FROM notifications
      WHERE user_id = ?
    `;

    const params: any[] = [req.userId];

    if (isRead !== undefined) {
      query += ' AND is_read = ?';
      params.push(isRead === 'true' || isRead === '1' ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const notifications = db.prepare(query).all(...params) as any[];

    const formatted = notifications.map(notif => ({
      id: notif.id,
      userId: notif.user_id,
      type: notif.type,
      title: notif.title,
      message: notif.message,
      link: notif.link,
      isRead: notif.is_read === 1,
      createdAt: new Date(notif.created_at),
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, (req: AuthRequest, res) => {
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = 0
    `).get(req.userId) as any;

    res.json({ success: true, data: { count: result.count || 0 } });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const notification = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(id) as any;
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    if (notification.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authenticateToken, (req: AuthRequest, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.userId);

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const notification = db.prepare('SELECT user_id FROM notifications WHERE id = ?').get(id) as any;
    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    if (notification.user_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM notifications WHERE id = ?').run(id);

    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
