import express from 'express';
import db from '../database/db.js';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get system settings
router.get('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    // Get system settings
    let systemSettings = db.prepare('SELECT * FROM settings WHERE id = ?').get('system') as any;
    
    // If no settings exist, create default
    if (!systemSettings) {
      db.prepare(`
        INSERT INTO settings (id, school_name, address, school_level, dark_mode, updated_at)
        VALUES ('system', 'LMS Sekolah', '', '', 0, datetime('now'))
      `).run();
      systemSettings = db.prepare('SELECT * FROM settings WHERE id = ?').get('system') as any;
    }

    // Get user-specific dark mode preference if user is logged in
    let userDarkMode = null;
    if (req.userId) {
      const userSetting = db.prepare('SELECT dark_mode FROM user_settings WHERE user_id = ?').get(req.userId) as any;
      if (userSetting) {
        userDarkMode = userSetting.dark_mode === 1;
      }
    }

    res.json({
      success: true,
      data: {
        schoolName: systemSettings.school_name,
        address: systemSettings.address || '',
        schoolLevel: systemSettings.school_level || '',
        darkMode: userDarkMode !== null ? userDarkMode : (systemSettings.dark_mode === 1),
        paymentSettings: {
          defaultAmount: systemSettings.payment_default_amount || 0,
          defaultDueDay: systemSettings.payment_default_due_day || 1,
          autoGenerate: systemSettings.payment_auto_generate === 1,
          bankName: systemSettings.bank_name || '',
          accountHolderName: systemSettings.account_holder_name || '',
          accountNumber: systemSettings.account_number || '',
          paymentMethods: systemSettings.payment_methods ? JSON.parse(systemSettings.payment_methods) : [],
        },
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update system settings (admin only)
router.put('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { schoolName, address, schoolLevel, paymentSettings } = req.body;

    // Check if settings exist
    let existing = db.prepare('SELECT id FROM settings WHERE id = ?').get('system') as any;
    
    if (!existing) {
      // Create new settings
      db.prepare(`
        INSERT INTO settings (
          id, school_name, address, school_level, 
          payment_default_amount, payment_default_due_day, payment_auto_generate,
          bank_name, account_holder_name, account_number, payment_methods,
          updated_at, updated_by
        )
        VALUES ('system', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(
        schoolName || 'LMS Sekolah',
        address || '',
        schoolLevel || '',
        paymentSettings?.defaultAmount ? parseFloat(paymentSettings.defaultAmount) : 0,
        paymentSettings?.defaultDueDay ? parseInt(paymentSettings.defaultDueDay) : 1,
        paymentSettings?.autoGenerate ? 1 : 0,
        paymentSettings?.bankName || '',
        paymentSettings?.accountHolderName || '',
        paymentSettings?.accountNumber || '',
        paymentSettings?.paymentMethods ? JSON.stringify(paymentSettings.paymentMethods) : '[]',
        req.userId
      );
    } else {
      // Update existing settings
      const updates: string[] = [];
      const values: any[] = [];
      
      if (schoolName !== undefined) {
        updates.push('school_name = ?');
        values.push(schoolName || 'LMS Sekolah');
      }
      if (address !== undefined) {
        updates.push('address = ?');
        values.push(address || '');
      }
      if (schoolLevel !== undefined) {
        updates.push('school_level = ?');
        values.push(schoolLevel || '');
      }
      if (paymentSettings) {
        if (paymentSettings.defaultAmount !== undefined) {
          updates.push('payment_default_amount = ?');
          values.push(paymentSettings.defaultAmount ? parseFloat(paymentSettings.defaultAmount) : 0);
        }
        if (paymentSettings.defaultDueDay !== undefined) {
          updates.push('payment_default_due_day = ?');
          values.push(paymentSettings.defaultDueDay ? parseInt(paymentSettings.defaultDueDay) : 1);
        }
        if (paymentSettings.autoGenerate !== undefined) {
          updates.push('payment_auto_generate = ?');
          values.push(paymentSettings.autoGenerate ? 1 : 0);
        }
        if (paymentSettings.bankName !== undefined) {
          updates.push('bank_name = ?');
          values.push(paymentSettings.bankName || '');
        }
        if (paymentSettings.accountHolderName !== undefined) {
          updates.push('account_holder_name = ?');
          values.push(paymentSettings.accountHolderName || '');
        }
        if (paymentSettings.accountNumber !== undefined) {
          updates.push('account_number = ?');
          values.push(paymentSettings.accountNumber || '');
        }
        if (paymentSettings.paymentMethods !== undefined) {
          updates.push('payment_methods = ?');
          values.push(JSON.stringify(paymentSettings.paymentMethods || []));
        }
      }
      
      updates.push('updated_at = datetime(\'now\')');
      updates.push('updated_by = ?');
      values.push(req.userId);
      values.push('system');
      
      if (updates.length > 2) { // More than just updated_at and updated_by
        db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
    }

    const updated = db.prepare('SELECT * FROM settings WHERE id = ?').get('system') as any;

    res.json({
      success: true,
      data: {
        schoolName: updated.school_name,
        address: updated.address || '',
        schoolLevel: updated.school_level || '',
        darkMode: updated.dark_mode === 1,
        paymentSettings: {
          defaultAmount: updated.payment_default_amount || 0,
          defaultDueDay: updated.payment_default_due_day || 1,
          autoGenerate: updated.payment_auto_generate === 1,
          bankName: updated.bank_name || '',
          accountHolderName: updated.account_holder_name || '',
          accountNumber: updated.account_number || '',
          paymentMethods: updated.payment_methods ? JSON.parse(updated.payment_methods) : [],
        },
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Update user dark mode preference
router.put('/dark-mode', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { darkMode } = req.body;
    const userId = req.userId;

    if (userId) {
      // Check if user setting exists
      const existing = db.prepare('SELECT user_id FROM user_settings WHERE user_id = ?').get(userId) as any;
      
      if (existing) {
        // Update existing
        db.prepare(`
          UPDATE user_settings 
          SET dark_mode = ?, updated_at = datetime('now')
          WHERE user_id = ?
        `).run(darkMode ? 1 : 0, userId);
      } else {
        // Create new
        db.prepare(`
          INSERT INTO user_settings (user_id, dark_mode, updated_at)
          VALUES (?, ?, datetime('now'))
        `).run(userId, darkMode ? 1 : 0);
      }
    }

    res.json({
      success: true,
      data: { darkMode: darkMode === true },
    });
  } catch (error) {
    console.error('Update dark mode error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
