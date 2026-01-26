import express from 'express';
import db from '../database/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get all users (with optional role filter)
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { role } = req.query;
    
    // Permission check: Only admin and teacher can access user list
    if (req.userRole !== 'admin' && req.userRole !== 'teacher') {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    
    // Teachers can only see students and teachers, not admins
    // Admins can see everyone
    let query = `
      SELECT id, student_number, teacher_number, admin_number, username, full_name, email, role,
             school_level, class_id, student_id, avatar, phone_number, birth_place, birth_date,
             kk_file, ktp_file, photo_file, address, created_at, updated_at
      FROM users
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Apply role filter
    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }
    
    // Teachers cannot see admin users
    if (req.userRole === 'teacher') {
      query += ' AND role != ?';
      params.push('admin');
    }
    
    query += ' ORDER BY created_at DESC';

    const users = db.prepare(query).all(...params) as any[];

    const formattedUsers = users.map(user => ({
      id: user.id,
      studentNumber: user.student_number,
      teacherNumber: user.teacher_number,
      adminNumber: user.admin_number,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      schoolLevel: user.school_level,
      classId: user.class_id,
      studentId: user.student_id,
      avatar: user.avatar,
      phoneNumber: user.phone_number,
      birthPlace: user.birth_place,
      birthDate: user.birth_date,
      kkFile: user.kk_file,
      ktpFile: user.ktp_file,
      photoFile: user.photo_file,
      address: user.address,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
    }));

    res.json({ success: true, data: formattedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Users can only view their own profile unless they're admin
    if (req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const user = db.prepare(`
      SELECT id, student_number, teacher_number, admin_number, username, full_name, email, role,
             school_level, class_id, student_id, avatar, phone_number, birth_place, birth_date,
             kk_file, ktp_file, photo_file, address, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(id) as any;

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // For parent role, get studentIds array
    let studentIds: string[] = [];
    if (user.role === 'parent' && user.student_id) {
      studentIds = [user.student_id];
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        studentNumber: user.student_number,
        teacherNumber: user.teacher_number,
        adminNumber: user.admin_number,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        schoolLevel: user.school_level,
        classId: user.class_id,
        studentId: user.student_id,
        studentIds: user.role === 'parent' ? studentIds : undefined,
        avatar: user.avatar,
        phoneNumber: user.phone_number,
        birthPlace: user.birth_place,
        birthDate: user.birth_date,
        kkFile: user.kk_file,
        ktpFile: user.ktp_file,
        photoFile: user.photo_file,
        address: user.address,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create user
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      studentNumber,
      teacherNumber,
      adminNumber,
      username,
      password,
      fullName,
      email,
      role,
      schoolLevel,
      classId,
      studentId,
    } = req.body;

    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (id, student_number, teacher_number, admin_number, username, password,
                         full_name, email, role, school_level, class_id, student_id,
                         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      id,
      studentNumber || null,
      teacherNumber || null,
      adminNumber || null,
      username,
      hashedPassword,
      fullName,
      email || null,
      role,
      schoolLevel || null,
      classId || null,
      studentId || null
    );

    const user = db.prepare(`
      SELECT id, student_number, teacher_number, admin_number, username, full_name, email, role,
             school_level, class_id, student_id, avatar, phone_number, birth_place, birth_date,
             kk_file, ktp_file, photo_file, address, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(id) as any;

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        studentNumber: user.student_number,
        teacherNumber: user.teacher_number,
        adminNumber: user.admin_number,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        schoolLevel: user.school_level,
        classId: user.class_id,
        studentId: user.student_id,
        avatar: user.avatar,
        phoneNumber: user.phone_number,
        birthPlace: user.birth_place,
        birthDate: user.birth_date,
        kkFile: user.kk_file,
        ktpFile: user.ktp_file,
        photoFile: user.photo_file,
        address: user.address,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update user
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    
    // Users can only update their own profile unless they're admin
    if (req.userRole !== 'admin' && req.userId !== id) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    const {
      studentNumber,
      teacherNumber,
      adminNumber,
      username,
      password,
      fullName,
      email,
      role,
      schoolLevel,
      classId,
      studentId,
      avatar,
      phoneNumber,
      birthPlace,
      birthDate,
      kkFile,
      ktpFile,
      photoFile,
      address,
    } = req.body;

    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check username uniqueness if changed
    if (username) {
      const usernameCheck = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (usernameCheck) {
        return res.status(400).json({ success: false, error: 'Username already exists' });
      }
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    if (studentNumber !== undefined) { updates.push('student_number = ?'); values.push(studentNumber); }
    if (teacherNumber !== undefined) { updates.push('teacher_number = ?'); values.push(teacherNumber); }
    if (adminNumber !== undefined) { updates.push('admin_number = ?'); values.push(adminNumber); }
    if (username !== undefined) { updates.push('username = ?'); values.push(username); }
    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    if (fullName !== undefined) { updates.push('full_name = ?'); values.push(fullName); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (role !== undefined && req.userRole === 'admin') { updates.push('role = ?'); values.push(role); }
    if (schoolLevel !== undefined) { updates.push('school_level = ?'); values.push(schoolLevel); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (studentId !== undefined) { updates.push('student_id = ?'); values.push(studentId); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    if (phoneNumber !== undefined) { updates.push('phone_number = ?'); values.push(phoneNumber); }
    if (birthPlace !== undefined) { updates.push('birth_place = ?'); values.push(birthPlace); }
    if (birthDate !== undefined) { updates.push('birth_date = ?'); values.push(birthDate); }
    if (kkFile !== undefined) { updates.push('kk_file = ?'); values.push(kkFile); }
    if (ktpFile !== undefined) { updates.push('ktp_file = ?'); values.push(ktpFile); }
    if (photoFile !== undefined) { updates.push('photo_file = ?'); values.push(photoFile); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }

    updates.push('updated_at = datetime(\'now\')');
    values.push(id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare(`
      SELECT id, student_number, teacher_number, admin_number, username, full_name, email, role,
             school_level, class_id, student_id, avatar, phone_number, birth_place, birth_date,
             kk_file, ktp_file, photo_file, address, created_at, updated_at
      FROM users
      WHERE id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: user.id,
        studentNumber: user.student_number,
        teacherNumber: user.teacher_number,
        adminNumber: user.admin_number,
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        schoolLevel: user.school_level,
        classId: user.class_id,
        studentId: user.student_id,
        avatar: user.avatar,
        phoneNumber: user.phone_number,
        birthPlace: user.birth_place,
        birthDate: user.birth_date,
        kkFile: user.kk_file,
        ktpFile: user.ktp_file,
        photoFile: user.photo_file,
        address: user.address,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      },
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete user
router.delete('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { id } = req.params;

    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
