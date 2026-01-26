import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs
router.get('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { userId, action, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let query = `
      SELECT id, user_id, user_name, action, details, ip_address, created_at
      FROM audit_logs
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }
    
    if (action) {
      query += ' AND action LIKE ?';
      params.push(`%${action}%`);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    const logs = db.prepare(query).all(...params) as any[];

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams: any[] = [];
    
    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }
    
    if (action) {
      countQuery += ' AND action LIKE ?';
      countParams.push(`%${action}%`);
    }

    const totalResult = db.prepare(countQuery).get(...countParams) as any;
    const total = totalResult.total;

    const formattedLogs = logs.map(log => ({
      id: log.id,
      userId: log.user_id,
      userName: log.user_name,
      action: log.action,
      details: log.details,
      ipAddress: log.ip_address,
      createdAt: new Date(log.created_at),
    }));

    res.json({
      success: true,
      data: formattedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get audit log by ID
router.get('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const log = db.prepare(`
      SELECT id, user_id, user_name, action, details, ip_address, created_at
      FROM audit_logs
      WHERE id = ?
    `).get(id) as any;

    if (!log) {
      return res.status(404).json({ success: false, error: 'Audit log not found' });
    }

    res.json({
      success: true,
      data: {
        id: log.id,
        userId: log.user_id,
        userName: log.user_name,
        action: log.action,
        details: log.details,
        ipAddress: log.ip_address,
        createdAt: new Date(log.created_at),
      },
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create audit log (internal use - called by other routes)
export function createAuditLog(
  userId: string,
  userName: string,
  action: string,
  details?: string,
  ipAddress?: string
) {
  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, userId, userName, action, details || null, ipAddress || null);
  } catch (error) {
    console.error('Create audit log error:', error);
    // Don't throw - audit logging should not break main functionality
  }
}

export default router;
