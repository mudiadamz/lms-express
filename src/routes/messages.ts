import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get conversations (list of users you've messaged or received messages from)
router.get('/conversations', authenticateToken, (req: AuthRequest, res) => {
  try {
    const conversations = db.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as other_user_id,
        CASE 
          WHEN sender_id = ? THEN receiver_id
          ELSE sender_id
        END as user_id,
        MAX(created_at) as last_message_time
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
    `).all(req.userId, req.userId, req.userId, req.userId) as any[];

    const conversationsWithUsers = conversations.map(conv => {
      const user = db.prepare('SELECT id, full_name, role, avatar FROM users WHERE id = ?').get(conv.other_user_id) as any;
      const unreadCount = db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
      `).get(req.userId, conv.other_user_id) as any;

      return {
        userId: user?.id,
        userName: user?.full_name,
        userRole: user?.role,
        userAvatar: user?.avatar,
        lastMessageTime: new Date(conv.last_message_time),
        unreadCount: unreadCount?.count || 0,
      };
    });

    res.json({ success: true, data: conversationsWithUsers });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get messages with a specific user
router.get('/:userId', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Check if user exists
    const otherUser = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as any;
    if (!otherUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const messages = db.prepare(`
      SELECT id, sender_id, receiver_id, subject, content, is_read, created_at
      FROM messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.userId, userId, userId, req.userId, parseInt(limit as string), parseInt(offset as string)) as any[];

    // Mark messages as read
    db.prepare(`
      UPDATE messages SET is_read = 1 
      WHERE receiver_id = ? AND sender_id = ? AND is_read = 0
    `).run(req.userId, userId);

    // Get attachments for each message
    const messagesWithAttachments = messages.map(msg => {
      const attachments = db.prepare(`
        SELECT id, file_url, file_name FROM message_attachments WHERE message_id = ?
      `).all(msg.id) as any[];

      return {
        id: msg.id,
        senderId: msg.sender_id,
        receiverId: msg.receiver_id,
        subject: msg.subject,
        content: msg.content,
        isRead: msg.is_read === 1,
        attachments: attachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(msg.created_at),
      };
    });

    res.json({ success: true, data: messagesWithAttachments.reverse() }); // Reverse to show oldest first
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Send message
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { receiverId, subject, content, attachments } = req.body;

    if (!receiverId || !content) {
      return res.status(400).json({ success: false, error: 'receiverId and content required' });
    }

    // Check if receiver exists
    const receiver = db.prepare('SELECT id FROM users WHERE id = ?').get(receiverId) as any;
    if (!receiver) {
      return res.status(404).json({ success: false, error: 'Receiver not found' });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO messages (id, sender_id, receiver_id, subject, content, is_read)
      VALUES (?, ?, ?, ?, ?, 0)
    `).run(id, req.userId, receiverId, subject || null, content);

    // Add attachments
    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        if (attachment.fileUrl && attachment.fileName) {
          const attachmentId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO message_attachments (id, message_id, file_url, file_name)
            VALUES (?, ?, ?, ?)
          `).run(attachmentId, id, attachment.fileUrl, attachment.fileName);
        }
      }
    }

    // Create notification for receiver
    const notificationId = crypto.randomUUID();
    const sender = db.prepare('SELECT full_name FROM users WHERE id = ?').get(req.userId) as any;
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, link)
      VALUES (?, ?, 'message', ?, ?, ?)
    `).run(
      notificationId,
      receiverId,
      `New message from ${sender?.full_name || 'User'}`,
      content.substring(0, 100),
      `/messages/${req.userId}`
    );

    const message = db.prepare(`
      SELECT id, sender_id, receiver_id, subject, content, is_read, created_at
      FROM messages WHERE id = ?
    `).get(id) as any;

    const messageAttachments = db.prepare(`
      SELECT id, file_url, file_name FROM message_attachments WHERE message_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: message.id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        subject: message.subject,
        content: message.content,
        isRead: message.is_read === 1,
        attachments: messageAttachments.map(a => ({ id: a.id, fileUrl: a.file_url, fileName: a.file_name })),
        createdAt: new Date(message.created_at),
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Mark message as read
router.patch('/:id/read', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT receiver_id FROM messages WHERE id = ?').get(id) as any;
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    if (message.receiver_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete message
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const message = db.prepare('SELECT sender_id, receiver_id FROM messages WHERE id = ?').get(id) as any;
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Only sender or receiver can delete
    if (message.sender_id !== req.userId && message.receiver_id !== req.userId) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM messages WHERE id = ?').run(id);

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
