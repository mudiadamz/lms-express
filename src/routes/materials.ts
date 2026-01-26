import express from 'express';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get materials
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, subjectId } = req.query;
    let query = `
      SELECT m.id, m.title, m.description, m.type, m.subject_id, m.class_id, m.teacher_id,
             m.file_url, m.external_url, m.created_at,
             u.full_name as teacher_name
      FROM materials m
      LEFT JOIN users u ON m.teacher_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (classId) {
      query += ' AND m.class_id = ?';
      params.push(classId);
    }
    
    if (subjectId) {
      query += ' AND m.subject_id = ?';
      params.push(subjectId);
    }
    
    if (req.userRole === 'student') {
      const user = db.prepare('SELECT class_id FROM users WHERE id = ?').get(req.userId) as any;
      if (user?.class_id) {
        query += ' AND m.class_id = ?';
        params.push(user.class_id);
      }
    }
    
    query += ' ORDER BY m.created_at DESC';

    const materials = db.prepare(query).all(...params) as any[];

    const formattedMaterials = materials.map(material => {
      const attachments = db.prepare(`
        SELECT file_url, file_name FROM material_attachments WHERE material_id = ?
      `).all(material.id) as any[];

      return {
        id: material.id,
        title: material.title,
        description: material.description,
        type: material.type,
        subjectId: material.subject_id,
        classId: material.class_id,
        teacherId: material.teacher_id,
        teacherName: material.teacher_name,
        fileUrl: material.file_url,
        externalUrl: material.external_url,
        attachments: attachments.map(a => a.file_url),
        createdAt: new Date(material.created_at),
      };
    });

    res.json({ success: true, data: formattedMaterials });
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get material by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const material = db.prepare(`
      SELECT m.id, m.title, m.description, m.type, m.subject_id, m.class_id, m.teacher_id,
             m.file_url, m.external_url, m.created_at,
             u.full_name as teacher_name
      FROM materials m
      LEFT JOIN users u ON m.teacher_id = u.id
      WHERE m.id = ?
    `).get(id) as any;

    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    const attachments = db.prepare(`
      SELECT file_url, file_name FROM material_attachments WHERE material_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: material.id,
        title: material.title,
        description: material.description,
        type: material.type,
        subjectId: material.subject_id,
        classId: material.class_id,
        teacherId: material.teacher_id,
        teacherName: material.teacher_name,
        fileUrl: material.file_url,
        externalUrl: material.external_url,
        attachments: attachments.map(a => a.file_url),
        createdAt: new Date(material.created_at),
      },
    });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create material
router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { title, description, type, subjectId, classId, fileUrl, externalUrl, attachments } = req.body;

    if (!title || !type || !subjectId || !classId) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const id = crypto.randomUUID();
    const teacherId = req.userId!;

    db.prepare(`
      INSERT INTO materials (id, title, description, type, subject_id, class_id, teacher_id,
                             file_url, external_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, title, description || null, type, subjectId, classId, teacherId, fileUrl || null, externalUrl || null);

    // Insert attachments
    if (attachments && Array.isArray(attachments)) {
      const insertAttachment = db.prepare(`
        INSERT INTO material_attachments (id, material_id, file_url, file_name)
        VALUES (?, ?, ?, ?)
      `);
      
      for (const attachment of attachments) {
        const attachmentId = crypto.randomUUID();
        insertAttachment.run(attachmentId, id, attachment.url || attachment, attachment.name || attachment);
      }
    }

    const material = db.prepare(`
      SELECT id, title, description, type, subject_id, class_id, teacher_id,
             file_url, external_url, created_at
      FROM materials
      WHERE id = ?
    `).get(id) as any;

    const materialAttachments = db.prepare(`
      SELECT file_url FROM material_attachments WHERE material_id = ?
    `).all(id) as any[];

    res.status(201).json({
      success: true,
      data: {
        id: material.id,
        title: material.title,
        description: material.description,
        type: material.type,
        subjectId: material.subject_id,
        classId: material.class_id,
        teacherId: material.teacher_id,
        fileUrl: material.file_url,
        externalUrl: material.external_url,
        attachments: materialAttachments.map(a => a.file_url),
        createdAt: new Date(material.created_at),
      },
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update material
router.put('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, subjectId, classId, fileUrl, externalUrl, attachments } = req.body;

    const material = db.prepare('SELECT teacher_id FROM materials WHERE id = ?').get(id) as any;
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    if (material.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (type !== undefined) { updates.push('type = ?'); values.push(type); }
    if (subjectId !== undefined) { updates.push('subject_id = ?'); values.push(subjectId); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (fileUrl !== undefined) { updates.push('file_url = ?'); values.push(fileUrl); }
    if (externalUrl !== undefined) { updates.push('external_url = ?'); values.push(externalUrl); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE materials SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    // Update attachments if provided
    if (attachments !== undefined) {
      db.prepare('DELETE FROM material_attachments WHERE material_id = ?').run(id);
      
      if (Array.isArray(attachments) && attachments.length > 0) {
        const insertAttachment = db.prepare(`
          INSERT INTO material_attachments (id, material_id, file_url, file_name)
          VALUES (?, ?, ?, ?)
        `);
        
        for (const attachment of attachments) {
          const attachmentId = crypto.randomUUID();
          insertAttachment.run(attachmentId, id, attachment.url || attachment, attachment.name || attachment);
        }
      }
    }

    const updatedMaterial = db.prepare(`
      SELECT id, title, description, type, subject_id, class_id, teacher_id,
             file_url, external_url, created_at
      FROM materials
      WHERE id = ?
    `).get(id) as any;

    const materialAttachments = db.prepare(`
      SELECT file_url FROM material_attachments WHERE material_id = ?
    `).all(id) as any[];

    res.json({
      success: true,
      data: {
        id: updatedMaterial.id,
        title: updatedMaterial.title,
        description: updatedMaterial.description,
        type: updatedMaterial.type,
        subjectId: updatedMaterial.subject_id,
        classId: updatedMaterial.class_id,
        teacherId: updatedMaterial.teacher_id,
        fileUrl: updatedMaterial.file_url,
        externalUrl: updatedMaterial.external_url,
        attachments: materialAttachments.map(a => a.file_url),
        createdAt: new Date(updatedMaterial.created_at),
      },
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete material
router.delete('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const material = db.prepare('SELECT teacher_id FROM materials WHERE id = ?').get(id) as any;
    if (!material) {
      return res.status(404).json({ success: false, error: 'Material not found' });
    }

    if (material.teacher_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    db.prepare('DELETE FROM materials WHERE id = ?').run(id);

    res.json({ success: true, message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
