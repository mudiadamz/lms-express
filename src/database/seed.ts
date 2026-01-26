import db from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Note: Install bcryptjs: npm install bcryptjs
// Note: Install @types/bcryptjs: npm install --save-dev @types/bcryptjs

// Helper function to generate UUID
function uuid() {
  return crypto.randomUUID();
}

// Hash password helper
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Create default password hash
  const defaultPassword = await hashPassword('password');
  console.log('✅ Password hash created');

  // Insert Master Academic Years
  const masterAcademicYears = [
    { name: '2022/2023', startDate: '2022-07-01', endDate: '2023-06-30', isActive: 0 },
    { name: '2023/2024', startDate: '2023-07-01', endDate: '2024-06-30', isActive: 0 },
    { name: '2024/2025', startDate: '2024-07-01', endDate: '2025-06-30', isActive: 1 },
    { name: '2025/2026', startDate: '2025-07-01', endDate: '2026-06-30', isActive: 0 },
    { name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: 0 },
  ];

  console.log('📅 Creating master academic years...');
  let academicYearId = uuid();
  for (const yearData of masterAcademicYears) {
    try {
      const existingYear = db.prepare('SELECT id FROM academic_years WHERE name = ?').get(yearData.name) as any;
      if (existingYear) {
        if (yearData.isActive === 1) {
          academicYearId = existingYear.id;
        }
        console.log(`ℹ️  Academic year ${yearData.name} already exists`);
      } else {
        const yearId = uuid();
        db.prepare(`
          INSERT OR IGNORE INTO academic_years (id, name, start_date, end_date, is_active)
          VALUES (?, ?, ?, ?, ?)
        `).run(yearId, yearData.name, yearData.startDate, yearData.endDate, yearData.isActive);
        console.log(`✅ Academic year created: ${yearData.name}${yearData.isActive === 1 ? ' (Active)' : ''}`);
        if (yearData.isActive === 1) {
          academicYearId = yearId;
        }
      }
    } catch (error) {
      console.log(`⚠️  Academic year ${yearData.name} error:`, error);
    }
  }
  
  // Ensure only one active academic year
  try {
    const activeYears = db.prepare('SELECT id FROM academic_years WHERE is_active = 1').all() as any[];
    if (activeYears.length > 1) {
      // Keep only the first one active, deactivate others
      for (let i = 1; i < activeYears.length; i++) {
        db.prepare('UPDATE academic_years SET is_active = 0 WHERE id = ?').run(activeYears[i].id);
      }
    }
    // If no active year, activate 2024/2025
    if (activeYears.length === 0) {
      const year2024 = db.prepare('SELECT id FROM academic_years WHERE name = ?').get('2024/2025') as any;
      if (year2024) {
        db.prepare('UPDATE academic_years SET is_active = 1 WHERE id = ?').run(year2024.id);
        academicYearId = year2024.id;
      }
    } else {
      academicYearId = activeYears[0].id;
    }
  } catch (error) {
    console.log('⚠️  Error managing active academic year:', error);
  }
  
  console.log(`✅ Master academic years seeding completed`);

  // Insert Master Classes
  const masterClasses = [
    // SD (Sekolah Dasar) - IA sampai 6A
    { name: 'IA', grade: 1, schoolLevel: 'sd' },
    { name: 'IIA', grade: 2, schoolLevel: 'sd' },
    { name: 'IIIA', grade: 3, schoolLevel: 'sd' },
    { name: 'IVA', grade: 4, schoolLevel: 'sd' },
    { name: 'VA', grade: 5, schoolLevel: 'sd' },
    { name: 'VIA', grade: 6, schoolLevel: 'sd' },
    // SMP (Sekolah Menengah Pertama) - 7A, 8A, 9A
    { name: '7A', grade: 7, schoolLevel: 'smp' },
    { name: '8A', grade: 8, schoolLevel: 'smp' },
    { name: '9A', grade: 9, schoolLevel: 'smp' },
    // SMA (Sekolah Menengah Atas) - 10A, 11A, 12A
    { name: '10A', grade: 10, schoolLevel: 'sma' },
    { name: '11A', grade: 11, schoolLevel: 'sma' },
    { name: '12A', grade: 12, schoolLevel: 'sma' },
  ];

  console.log('📚 Creating master classes...');
  for (const classData of masterClasses) {
    try {
      const classId = uuid();
      db.prepare(`
        INSERT OR IGNORE INTO classes (id, name, grade, school_level, homeroom_teacher_id, academic_year, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(classId, classData.name, classData.grade, classData.schoolLevel, null, academicYearId, 1);
      console.log(`✅ Class created: ${classData.name} (${classData.schoolLevel.toUpperCase()})`);
    } catch (error) {
      console.log(`⚠️  Class ${classData.name} already exists or error:`, error);
    }
  }
  console.log(`✅ Created ${masterClasses.length} master classes`);

  // Insert Users - Check if they exist first
  let studentId = uuid();
  let teacherId = uuid();
  const adminId = uuid();
  const parentId = uuid();

  // Check if users already exist
  const existingStudent = db.prepare('SELECT id FROM users WHERE username = ?').get('student') as any;
  const existingTeacher = db.prepare('SELECT id FROM users WHERE username = ?').get('teacher') as any;
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin') as any;
  const existingParent = db.prepare('SELECT id FROM users WHERE username = ?').get('parent') as any;

  // Insert Student
  if (!existingStudent) {
    try {
      db.prepare(`
        INSERT INTO users (id, student_number, username, password, full_name, email, role, school_level, class_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(studentId, '2024001', 'student', defaultPassword, 'Budi Santoso', 'student@example.com', 'student', 'sma', null);
      console.log('✅ Student user created: student / password');
    } catch (error) {
      console.error('❌ Error creating student:', error);
    }
  } else {
    console.log('ℹ️  Student user already exists');
    // Use existing student ID for parent
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('student') as any;
    if (existing) studentId = existing.id;
  }

  // Insert Teacher
  if (!existingTeacher) {
    try {
      db.prepare(`
        INSERT INTO users (id, teacher_number, username, password, full_name, email, role, school_level, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(teacherId, '1985001', 'teacher', defaultPassword, 'Ibu Siti', 'teacher@example.com', 'teacher', 'sma');
      console.log('✅ Teacher user created: teacher / password');
    } catch (error) {
      console.error('❌ Error creating teacher:', error);
    }
  } else {
    console.log('ℹ️  Teacher user already exists');
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('teacher') as any;
    if (existing) teacherId = existing.id;
  }

  // Insert Admin
  if (!existingAdmin) {
    try {
      db.prepare(`
        INSERT INTO users (id, admin_number, username, password, full_name, email, role, school_level, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(adminId, 'ADM001', 'admin', defaultPassword, 'Admin Sekolah', 'admin@example.com', 'admin', 'sma');
      console.log('✅ Admin user created: admin / password');
    } catch (error) {
      console.error('❌ Error creating admin:', error);
    }
  } else {
    console.log('ℹ️  Admin user already exists');
  }

  // Insert Parent (needs studentId)
  if (!existingParent) {
    try {
      // Get student ID if not set
      let finalStudentId = studentId;
      if (existingStudent) {
        const student = db.prepare('SELECT id FROM users WHERE username = ?').get('student') as any;
        if (student) finalStudentId = student.id;
      }
      
      db.prepare(`
        INSERT INTO users (id, username, password, full_name, email, role, student_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(parentId, 'parent', defaultPassword, 'Bapak Santoso', 'parent@example.com', 'parent', finalStudentId);
      console.log('✅ Parent user created: parent / password');
    } catch (error) {
      console.error('❌ Error creating parent:', error);
    }
  } else {
    console.log('ℹ️  Parent user already exists');
  }

  // Get teacher ID (use existing or new)
  let finalTeacherId = teacherId;
  if (existingTeacher) {
    const teacher = db.prepare('SELECT id FROM users WHERE username = ?').get('teacher') as any;
    if (teacher) finalTeacherId = teacher.id;
  }

  // Insert Class (for default student - use existing 10A if available, otherwise create X IPA 1)
  let classId = uuid();
  try {
    // Try to use existing 10A class first
    const existing10A = db.prepare('SELECT id FROM classes WHERE name = ? AND school_level = ?').get('10A', 'sma') as any;
    if (existing10A) {
      classId = existing10A.id;
      console.log('✅ Using existing class: 10A');
    } else {
      // Create X IPA 1 as fallback for backward compatibility
      db.prepare(`
        INSERT OR IGNORE INTO classes (id, name, grade, school_level, homeroom_teacher_id, academic_year, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(classId, 'X IPA 1', 10, 'sma', finalTeacherId, academicYearId, 1);
      console.log('✅ Class created: X IPA 1');
    }
  } catch (error) {
    console.log('⚠️  Class already exists or error:', error);
    // Get existing class
    const existingClass = db.prepare('SELECT id FROM classes WHERE name = ?').get('X IPA 1') as any;
    if (existingClass) {
      classId = existingClass.id;
    } else {
      // Try 10A
      const existing10A = db.prepare('SELECT id FROM classes WHERE name = ? AND school_level = ?').get('10A', 'sma') as any;
      if (existing10A) {
        classId = existing10A.id;
      }
    }
  }

  // Update student with class_id
  let finalStudentId = studentId;
  if (existingStudent) {
    const student = db.prepare('SELECT id FROM users WHERE username = ?').get('student') as any;
    if (student) finalStudentId = student.id;
  }
  
  try {
    db.prepare(`UPDATE users SET class_id = ? WHERE id = ?`).run(classId, finalStudentId);
    console.log('✅ Student assigned to class');
  } catch (error) {
    console.log('⚠️  Error assigning student to class:', error);
  }

  // Insert Subject
  let subjectId = uuid();
  try {
    db.prepare(`
      INSERT OR IGNORE INTO subjects (id, name, code, description, school_level, teacher_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(subjectId, 'Matematika', 'MAT', 'Mata Pelajaran Matematika', 'sma', finalTeacherId);
    console.log('✅ Subject created: Matematika');
  } catch (error) {
    console.log('⚠️  Subject already exists or error:', error);
    const existingSubject = db.prepare('SELECT id FROM subjects WHERE code = ?').get('MAT') as any;
    if (existingSubject) {
      subjectId = existingSubject.id;
    }
  }

  // Link class and subject
  try {
    db.prepare(`
      INSERT OR IGNORE INTO class_subjects (class_id, subject_id)
      VALUES (?, ?)
    `).run(classId, subjectId);
    console.log('✅ Class-Subject linked');
  } catch (error) {
    console.log('⚠️  Class-Subject link already exists');
  }

  // Link student to class
  try {
    db.prepare(`
      INSERT OR IGNORE INTO class_students (class_id, student_id)
      VALUES (?, ?)
    `).run(classId, finalStudentId);
    console.log('✅ Student-Class linked');
  } catch (error) {
    console.log('⚠️  Student-Class link already exists');
  }

  // Seed Settings with default payment methods
  console.log('\n⚙️  Seeding settings...');
  try {
    const existingSettings = db.prepare('SELECT id FROM settings WHERE id = ?').get('system') as any;
    
    if (!existingSettings) {
      // Create default settings with payment methods
      db.prepare(`
        INSERT INTO settings (
          id, school_name, address, school_level, dark_mode,
          payment_default_amount, payment_default_due_day, payment_auto_generate,
          bank_name, account_holder_name, account_number, payment_methods,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        'system',
        'LMS Sekolah',
        '',
        '',
        0,
        0,
        1,
        0,
        'Bank BCA',
        'Yayasan Pendidikan Sekolah',
        '1234567890',
        JSON.stringify(['Transfer Bank', 'Tunai'])
      );
      console.log('✅ Settings created with default payment methods');
    } else {
      // Update payment methods if not set
      const currentSettings = db.prepare('SELECT payment_methods FROM settings WHERE id = ?').get('system') as any;
      if (!currentSettings?.payment_methods || currentSettings.payment_methods === '[]' || currentSettings.payment_methods === '') {
        db.prepare(`
          UPDATE settings 
          SET payment_methods = ?,
              bank_name = COALESCE(NULLIF(bank_name, ''), 'Bank BCA'),
              account_holder_name = COALESCE(NULLIF(account_holder_name, ''), 'Yayasan Pendidikan Sekolah'),
              account_number = COALESCE(NULLIF(account_number, ''), '1234567890'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(['Transfer Bank', 'Tunai']), 'system');
        console.log('✅ Settings updated with default payment methods');
      } else {
        console.log('ℹ️  Settings already have payment methods');
      }
    }
  } catch (error) {
    console.log('⚠️  Error seeding settings:', error);
  }

  console.log('');
  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('📋 Default Credentials:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👤 Student:');
  console.log('   Username: student');
  console.log('   Password: password');
  console.log('');
  console.log('👨‍🏫 Teacher:');
  console.log('   Username: teacher');
  console.log('   Password: password');
  console.log('');
  console.log('👑 Admin:');
  console.log('   Username: admin');
  console.log('   Password: password');
  console.log('');
  console.log('👨‍👩 Parent:');
  console.log('   Username: parent');
  console.log('   Password: password');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed().catch(console.error);
