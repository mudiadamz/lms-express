import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import db from '../database/db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/octet-stream'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

// Import users from Excel
router.post('/import-users', authenticateToken, requireRole('admin'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { role, academicYearId } = req.body;
    if (!role || !['student', 'teacher', 'admin', 'parent'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    if (role === 'student' && !academicYearId) {
      return res.status(400).json({ success: false, error: 'Academic year is required for student import' });
    }

    let academicYearName = '';
    if (role === 'student' && academicYearId) {
      const academicYear = db.prepare('SELECT name FROM academic_years WHERE id = ?').get(academicYearId) as any;
      if (!academicYear) {
        return res.status(400).json({ success: false, error: 'Academic year not found' });
      }
      academicYearName = academicYear.name;
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Excel file is empty' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as any;
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and we skip header

      try {
        // Map Excel columns to user fields based on role
        let username = '';
        let password = '';
        let fullName = '';
        let email = '';
        let schoolLevel = '';
        let classId = '';
        let phoneNumber = '';
        let birthPlace = '';
        let birthDate = '';
        let address = '';
        let studentNumber = '';
        let teacherNumber = '';
        let adminNumber = '';

        if (role === 'student') {
          username = String(row['Username'] || row['username'] || '').trim();
          password = String(row['Password'] || row['password'] || '').trim();
          fullName = String(row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || row['nama'] || '').trim();
          email = String(row['Email'] || row['email'] || '').trim();
          schoolLevel = String(row['Tingkat Sekolah'] || row['tingkat_sekolah'] || row['School Level'] || '').trim().toLowerCase();
          classId = String(
            row['Kelas ID'] ||
              row['kelas_id'] ||
              row['Class ID'] ||
              row['Kelas'] ||
              row['kelas'] ||
              row['Class'] ||
              ''
          ).trim();
          phoneNumber = String(row['No. HP'] || row['no_hp'] || row['Phone'] || '').trim();
          birthPlace = String(row['Tempat Lahir'] || row['tempat_lahir'] || row['Birth Place'] || '').trim();
          birthDate = String(row['Tanggal Lahir'] || row['tanggal_lahir'] || row['Birth Date'] || '').trim();
          address = String(row['Alamat'] || row['alamat'] || row['Address'] || '').trim();
          studentNumber = String(row['NIS'] || row['nis'] || row['Student Number'] || '').trim();
        } else if (role === 'teacher') {
          username = String(row['Username'] || row['username'] || '').trim();
          password = String(row['Password'] || row['password'] || '').trim();
          fullName = String(row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || row['nama'] || '').trim();
          email = String(row['Email'] || row['email'] || '').trim();
          schoolLevel = '';
          phoneNumber = String(row['No. HP'] || row['no_hp'] || row['Phone'] || '').trim();
          birthPlace = String(row['Tempat Lahir'] || row['tempat_lahir'] || row['Birth Place'] || '').trim();
          birthDate = String(row['Tanggal Lahir'] || row['tanggal_lahir'] || row['Birth Date'] || '').trim();
          address = String(row['Alamat'] || row['alamat'] || row['Address'] || '').trim();
          teacherNumber = String(row['NIP'] || row['nip'] || row['Teacher Number'] || '').trim();
        } else if (role === 'admin') {
          username = String(row['Username'] || row['username'] || '').trim();
          password = String(row['Password'] || row['password'] || '').trim();
          fullName = String(row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || row['nama'] || '').trim();
          email = String(row['Email'] || row['email'] || '').trim();
          schoolLevel = String(row['Tingkat Sekolah'] || row['tingkat_sekolah'] || row['School Level'] || '').trim().toLowerCase();
          phoneNumber = String(row['No. HP'] || row['no_hp'] || row['Phone'] || '').trim();
          birthPlace = String(row['Tempat Lahir'] || row['tempat_lahir'] || row['Birth Place'] || '').trim();
          birthDate = String(row['Tanggal Lahir'] || row['tanggal_lahir'] || row['Birth Date'] || '').trim();
          address = String(row['Alamat'] || row['alamat'] || row['Address'] || '').trim();
          adminNumber = String(row['NIP Admin'] || row['nip_admin'] || row['Admin Number'] || '').trim();
        } else {
          username = String(row['Username'] || row['username'] || '').trim();
          password = String(row['Password'] || row['password'] || '').trim();
          fullName = String(row['Nama Lengkap'] || row['nama_lengkap'] || row['Nama'] || row['nama'] || '').trim();
          email = String(row['Email'] || row['email'] || '').trim();
          phoneNumber = String(row['No. HP'] || row['no_hp'] || row['Phone'] || '').trim();
          address = String(row['Alamat'] || row['alamat'] || row['Address'] || '').trim();
        }

        // Validate required fields
        if (!username || !password || !fullName) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            error: 'Username, Password, dan Nama Lengkap wajib diisi',
          });
          continue;
        }

        // Check if username already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
        if (existingUser) {
          results.failed++;
          results.errors.push({
            row: rowNumber,
            error: `Username "${username}" sudah digunakan`,
          });
          continue;
        }

        // Validate school level
        if (schoolLevel && !['sd', 'smp', 'sma'].includes(schoolLevel)) {
          schoolLevel = '';
        }

        if (role === 'student' && classId && academicYearName) {
          let resolvedClassId = '';
          const classById = db
            .prepare('SELECT id FROM classes WHERE id = ? AND academic_year = ?')
            .get(classId, academicYearName) as any;
          if (classById) {
            resolvedClassId = classById.id;
          } else {
            const classByName = db
              .prepare('SELECT id FROM classes WHERE name = ? AND academic_year = ?')
              .get(classId, academicYearName) as any;
            if (classByName) {
              resolvedClassId = classByName.id;
            }
          }

          if (!resolvedClassId) {
            results.failed++;
            results.errors.push({
              row: rowNumber,
              error: `Kelas "${classId}" tidak ditemukan untuk tahun ajaran ${academicYearName}`,
            });
            continue;
          }
          classId = resolvedClassId;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();

        // Insert user
        db.prepare(`
          INSERT INTO users (id, student_number, teacher_number, admin_number, username, password,
                             full_name, email, role, school_level, class_id, phone_number,
                             birth_place, birth_date, address, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
          phoneNumber || null,
          birthPlace || null,
          birthDate || null,
          address || null,
        );

        // If student, add to class_students if classId provided
        if (role === 'student' && classId) {
          try {
            db.prepare(`
              INSERT OR IGNORE INTO class_students (class_id, student_id)
              VALUES (?, ?)
            `).run(classId, id);
          } catch (err) {
            // Ignore if class doesn't exist
            console.warn(`Could not add student to class ${classId}:`, err);
          }
        }

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
        });
      }
    }

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Import users error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import users',
    });
  }
});

export default router;
