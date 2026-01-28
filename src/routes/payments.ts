import express from 'express';
import multer from 'multer';
import db from '../database/db.js';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'payments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `payment-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only image files and PDFs are allowed'));
    }
  },
});

// Get payments
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { classId, studentId, status, month, year } = req.query;
    
    // Check if payments table exists
    try {
      const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='payments'").get() as any;
      if (!tableCheck) {
        console.error('Payments table does not exist');
        return res.json({ success: true, data: [] });
      }
    } catch (tableError) {
      console.error('Error checking payments table:', tableError);
      return res.json({ success: true, data: [] });
    }
    
    let query = `
      SELECT p.id, p.student_id, p.class_id, p.month, p.year, p.amount, p.due_date,
             p.status, p.payment_method, p.receipt_number, p.receipt_file_url, p.notes, p.created_at,
             c.name as class_name,
             u.full_name as student_name,
             u.student_number as student_number
      FROM payments p
      LEFT JOIN classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.student_id = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (classId) {
      query += ' AND p.class_id = ?';
      params.push(classId);
    }
    
    if (studentId) {
      query += ' AND p.student_id = ?';
      params.push(studentId);
    }
    
    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    
    if (month) {
      query += ' AND p.month = ?';
      params.push(month);
    }
    
    if (year) {
      query += ' AND p.year = ?';
      params.push(parseInt(year as string));
    }
    
    // Students and parents can only see their own payments
    if (req.userRole === 'student') {
      query += ' AND p.student_id = ?';
      params.push(req.userId);
    } else if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id) {
        query += ' AND p.student_id = ?';
        params.push(parent.student_id);
      } else {
        // No student linked, return empty
        return res.json({ success: true, data: [] });
      }
    }
    
    query += ' ORDER BY p.year DESC, p.month DESC, p.created_at DESC';

    console.log('Executing query:', query);
    console.log('With params:', params);
    
    const payments = db.prepare(query).all(...params) as any[];
    
    console.log('Found payments:', payments.length);

    const formattedPayments = payments.map(payment => {
      try {
        return {
          id: payment.id,
          studentId: payment.student_id || null,
          studentName: payment.student_name || null,
          studentNumber: payment.student_number || null,
          classId: payment.class_id || null,
          className: payment.class_name || null,
          month: payment.month,
          year: payment.year,
          amount: payment.amount,
          dueDate: payment.due_date ? new Date(payment.due_date) : new Date(),
          status: payment.status,
          paymentMethod: payment.payment_method || null,
          receiptNumber: payment.receipt_number || null,
          receiptFileUrl: payment.receipt_file_url || null,
          notes: payment.notes || null,
          createdAt: payment.created_at ? new Date(payment.created_at) : new Date(),
        };
      } catch (mapError: any) {
        console.error('Error mapping payment:', payment, mapError);
        return null;
      }
    }).filter(p => p !== null);

    res.json({ success: true, data: formattedPayments });
  } catch (error: any) {
    console.error('Get payments error:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error?.message : undefined
    });
  }
});

// Get payment by ID
router.get('/:id', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const payment = db.prepare(`
      SELECT p.id, p.student_id, p.class_id, p.month, p.year, p.amount, p.due_date,
             p.status, p.payment_method, p.receipt_number, p.receipt_file_url, p.notes, p.created_at,
             c.name as class_name,
             u.full_name as student_name,
             u.student_number as student_number
      FROM payments p
      LEFT JOIN classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.student_id = u.id
      WHERE p.id = ?
    `).get(id) as any;

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Check permissions
    if (req.userRole === 'student') {
      if (payment.student_id !== req.userId) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    } else if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id !== payment.student_id) {
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    }

    res.json({
      success: true,
      data: {
        id: payment.id,
        studentId: payment.student_id,
        studentName: payment.student_name,
        studentNumber: payment.student_number,
        classId: payment.class_id,
        className: payment.class_name,
        month: payment.month,
        year: payment.year,
        amount: payment.amount,
        dueDate: new Date(payment.due_date),
        status: payment.status,
        paymentMethod: payment.payment_method,
        receiptNumber: payment.receipt_number,
        receiptFileUrl: payment.receipt_file_url,
        notes: payment.notes,
        createdAt: new Date(payment.created_at),
      },
    });
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Create payment
router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { classIds, month, year, amount, dueDate, notes, paymentMethod } = req.body;

    if (!classIds || !Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ success: false, error: 'classIds array is required' });
    }

    if (!month || !year || !amount || !dueDate) {
      return res.status(400).json({ success: false, error: 'Required fields missing' });
    }

    const createdPayments = [];

    // For each selected class, get all students and create payments
    for (const classId of classIds) {
      // Get all students in this class
      const students = db.prepare('SELECT id FROM users WHERE class_id = ? AND role = ?').all(classId, 'student') as any[];

      for (const student of students) {
        const studentId = student.id;
        const id = crypto.randomUUID();
        
        // Check if payment already exists for this student/month/year
        const existing = db.prepare(`
          SELECT id FROM payments 
          WHERE student_id = ? AND month = ? AND year = ?
        `).get(studentId, month, parseInt(year)) as any;

        if (existing) {
          continue; // Skip if already exists
        }

        db.prepare(`
          INSERT INTO payments (id, student_id, class_id, month, year, amount, due_date, status, payment_method, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
        `).run(
          id,
          studentId,
          classId,
          month,
          parseInt(year),
          parseFloat(amount),
          dueDate,
          paymentMethod || null,
          notes || null
        );

        const payment = db.prepare(`
          SELECT p.id, p.student_id, p.class_id, p.month, p.year, p.amount, p.due_date,
                 p.status, p.payment_method, p.receipt_number, p.receipt_file_url, p.notes, p.created_at,
                 c.name as class_name,
                 u.full_name as student_name,
                 u.student_number as student_number
          FROM payments p
          LEFT JOIN classes c ON p.class_id = c.id
          LEFT JOIN users u ON p.student_id = u.id
          WHERE p.id = ?
        `).get(id) as any;

        createdPayments.push({
          id: payment.id,
          studentId: payment.student_id,
          studentName: payment.student_name,
          studentNumber: payment.student_number,
          classId: payment.class_id,
          className: payment.class_name,
          month: payment.month,
          year: payment.year,
          amount: payment.amount,
          dueDate: new Date(payment.due_date),
          status: payment.status,
          paymentMethod: payment.payment_method,
          receiptNumber: payment.receipt_number,
          receiptFileUrl: payment.receipt_file_url,
          notes: payment.notes,
          createdAt: new Date(payment.created_at),
        });
      }
    }

    res.status(201).json({ success: true, data: createdPayments });
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Upload payment receipt (for students/parents)
router.post('/:id/upload-receipt', authenticateToken, upload.single('receipt'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, receiptNumber } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    // Check if payment exists and belongs to the user
    const payment = db.prepare(`
      SELECT p.id, p.student_id, p.status
      FROM payments p
      WHERE p.id = ?
    `).get(id) as any;

    if (!payment) {
      // Delete uploaded file if payment not found
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    // Check permissions: student can only upload for their own payments, parent for their child's payments
    if (req.userRole === 'student') {
      if (payment.student_id !== req.userId) {
        if (req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    } else if (req.userRole === 'parent') {
      const parent = db.prepare('SELECT student_id FROM users WHERE id = ?').get(req.userId) as any;
      if (parent?.student_id !== payment.student_id) {
        if (req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ success: false, error: 'Insufficient permissions' });
      }
    } else {
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ success: false, error: 'Only students and parents can upload receipts' });
    }

    // Only allow upload for pending/overdue payments
    if (payment.status === 'paid') {
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, error: 'Cannot upload receipt for paid payment' });
    }

    // Delete old receipt file if exists
    const oldPayment = db.prepare('SELECT receipt_file_url FROM payments WHERE id = ?').get(id) as any;
    if (oldPayment?.receipt_file_url) {
      const oldFilePath = path.join(process.cwd(), oldPayment.receipt_file_url);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update payment with receipt file URL and payment method
    // Change status to 'verifying' when receipt is uploaded
    const receiptFileUrl = `/uploads/payments/${req.file.filename}`;
    const updates: string[] = [];
    const values: any[] = [];

    updates.push('receipt_file_url = ?');
    values.push(receiptFileUrl);

    // Update status to indicate waiting for verification
    updates.push('status = ?');
    values.push('verifying');

    if (paymentMethod) {
      updates.push('payment_method = ?');
      values.push(paymentMethod);
    }

    if (receiptNumber) {
      updates.push('receipt_number = ?');
      values.push(receiptNumber);
    }

    // Status remains pending until admin verifies
    values.push(id);
    db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedPayment = db.prepare(`
      SELECT p.id, p.student_id, p.class_id, p.month, p.year, p.amount, p.due_date,
             p.status, p.payment_method, p.receipt_number, p.receipt_file_url, p.notes, p.created_at,
             c.name as class_name,
             u.full_name as student_name,
             u.student_number as student_number
      FROM payments p
      LEFT JOIN classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.student_id = u.id
      WHERE p.id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: updatedPayment.id,
        studentId: updatedPayment.student_id,
        studentName: updatedPayment.student_name,
        studentNumber: updatedPayment.student_number,
        classId: updatedPayment.class_id,
        className: updatedPayment.class_name,
        month: updatedPayment.month,
        year: updatedPayment.year,
        amount: updatedPayment.amount,
        dueDate: new Date(updatedPayment.due_date),
        status: updatedPayment.status,
        paymentMethod: updatedPayment.payment_method,
        receiptNumber: updatedPayment.receipt_number,
        receiptFileUrl: updatedPayment.receipt_file_url,
        notes: updatedPayment.notes,
        createdAt: new Date(updatedPayment.created_at),
      },
    });
  } catch (error) {
    console.error('Upload receipt error:', error);
    // Delete uploaded file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update payment
router.put('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { studentId, classId, month, year, amount, dueDate, status, paymentMethod, receiptNumber, notes } = req.body;

    const payment = db.prepare('SELECT id FROM payments WHERE id = ?').get(id) as any;
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (studentId !== undefined) { updates.push('student_id = ?'); values.push(studentId); }
    if (classId !== undefined) { updates.push('class_id = ?'); values.push(classId); }
    if (month !== undefined) { updates.push('month = ?'); values.push(month); }
    if (year !== undefined) { updates.push('year = ?'); values.push(parseInt(year)); }
    if (amount !== undefined) { updates.push('amount = ?'); values.push(parseFloat(amount)); }
    if (dueDate !== undefined) { updates.push('due_date = ?'); values.push(dueDate); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (paymentMethod !== undefined) { updates.push('payment_method = ?'); values.push(paymentMethod); }
    if (receiptNumber !== undefined) { updates.push('receipt_number = ?'); values.push(receiptNumber); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }

    if (updates.length > 0) {
      values.push(id);
      db.prepare(`UPDATE payments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const updatedPayment = db.prepare(`
      SELECT p.id, p.student_id, p.class_id, p.month, p.year, p.amount, p.due_date,
             p.status, p.payment_method, p.receipt_number, p.receipt_file_url, p.notes, p.created_at,
             c.name as class_name,
             u.full_name as student_name,
             u.student_number as student_number
      FROM payments p
      LEFT JOIN classes c ON p.class_id = c.id
      LEFT JOIN users u ON p.student_id = u.id
      WHERE p.id = ?
    `).get(id) as any;

    res.json({
      success: true,
      data: {
        id: updatedPayment.id,
        studentId: updatedPayment.student_id,
        studentName: updatedPayment.student_name,
        studentNumber: updatedPayment.student_number,
        classId: updatedPayment.class_id,
        className: updatedPayment.class_name,
        month: updatedPayment.month,
        year: updatedPayment.year,
        amount: updatedPayment.amount,
        dueDate: new Date(updatedPayment.due_date),
        status: updatedPayment.status,
        paymentMethod: updatedPayment.payment_method,
        receiptNumber: updatedPayment.receipt_number,
        receiptFileUrl: updatedPayment.receipt_file_url,
        notes: updatedPayment.notes,
        createdAt: new Date(updatedPayment.created_at),
      },
    });
  } catch (error) {
    console.error('Update payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Delete payment
router.delete('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const payment = db.prepare('SELECT id FROM payments WHERE id = ?').get(id) as any;
    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment not found' });
    }

    db.prepare('DELETE FROM payments WHERE id = ?').run(id);

    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
