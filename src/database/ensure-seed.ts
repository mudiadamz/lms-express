import db from './db.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createTables } from './schema.js';

async function ensureSeed() {
  console.log('🌱 Ensuring database is seeded...\n');

  // Ensure tables exist first
  try {
    createTables();
    console.log('✅ Database tables verified\n');
  } catch (error: any) {
    if (error?.message?.includes('already exists')) {
      console.log('✅ Database tables already exist\n');
    } else {
      console.error('⚠️  Error creating tables:', error?.message);
      throw error;
    }
  }

  // Check if users exist
  const existingUsers = db.prepare('SELECT username FROM users WHERE username IN (?, ?, ?, ?)').all('student', 'teacher', 'admin', 'parent') as any[];

  if (existingUsers.length === 4) {
    console.log('✅ All default users exist');
    
    // Verify passwords are correct
    console.log('\n🔍 Verifying passwords...');
    const testPassword = 'password';
    let allValid = true;

    for (const user of existingUsers) {
      const fullUser = db.prepare('SELECT username, password FROM users WHERE username = ?').get(user.username) as any;
      if (fullUser && fullUser.password) {
        const isValid = await bcrypt.compare(testPassword, fullUser.password);
        const status = isValid ? '✅' : '❌';
        console.log(`   ${status} ${user.username}: ${isValid ? 'Valid' : 'Invalid - needs fix'}`);
        if (!isValid) allValid = false;
      }
    }

    if (allValid) {
      console.log('\n✅ All passwords are valid!');
      return;
    } else {
      console.log('\n⚠️  Some passwords are invalid. Fixing...');
    }
  } else {
    console.log(`⚠️  Only ${existingUsers.length}/4 users found. Seeding...`);
  }

  // Seed users
  console.log('\n📝 Seeding users...');
  const defaultPassword = await bcrypt.hash('password', 10);
  console.log('✅ Password hash created:', defaultPassword.substring(0, 30) + '...\n');

  const users = [
    {
      username: 'student',
      role: 'student',
      fullName: 'Budi Santoso',
      email: 'student@example.com',
      studentNumber: '2024001',
      schoolLevel: 'sma'
    },
    {
      username: 'teacher',
      role: 'teacher',
      fullName: 'Ibu Siti',
      email: 'teacher@example.com',
      teacherNumber: '1985001',
      schoolLevel: 'sma'
    },
    {
      username: 'admin',
      role: 'admin',
      fullName: 'Admin Sekolah',
      email: 'admin@example.com',
      adminNumber: 'ADM001',
      schoolLevel: 'sma'
    },
    {
      username: 'parent',
      role: 'parent',
      fullName: 'Bapak Santoso',
      email: 'parent@example.com'
    }
  ];

  for (const userData of users) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(userData.username) as any;
    
    if (existing) {
      // Update password
      db.prepare('UPDATE users SET password = ? WHERE username = ?').run(defaultPassword, userData.username);
      console.log(`✅ Updated password for ${userData.username}`);
    } else {
      // Insert new user
      const id = crypto.randomUUID();
      db.prepare(`
        INSERT INTO users (id, username, password, full_name, email, role, school_level,
                          student_number, teacher_number, admin_number, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).run(
        id,
        userData.username,
        defaultPassword,
        userData.fullName,
        userData.email,
        userData.role,
        userData.schoolLevel || null,
        userData.studentNumber || null,
        userData.teacherNumber || null,
        userData.adminNumber || null
      );
      console.log(`✅ Created user: ${userData.username}`);
    }
  }

  // Verify all users
  console.log('\n🔍 Verifying all users...');
  for (const userData of users) {
    const user = db.prepare('SELECT username, password FROM users WHERE username = ?').get(userData.username) as any;
    if (user) {
      const isValid = await bcrypt.compare('password', user.password);
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} ${userData.username}: ${isValid ? 'Valid' : 'Invalid'}`);
    }
  }

  // Seed Master Academic Years
  console.log('\n📅 Seeding master academic years...');
  const masterAcademicYears = [
    { name: '2022/2023', startDate: '2022-07-01', endDate: '2023-06-30', isActive: 0 },
    { name: '2023/2024', startDate: '2023-07-01', endDate: '2024-06-30', isActive: 0 },
    { name: '2024/2025', startDate: '2024-07-01', endDate: '2025-06-30', isActive: 1 },
    { name: '2025/2026', startDate: '2025-07-01', endDate: '2026-06-30', isActive: 0 },
    { name: '2026/2027', startDate: '2026-07-01', endDate: '2027-06-30', isActive: 0 },
  ];

  let academicYearId: string;
  let createdCount = 0;
  
  for (const yearData of masterAcademicYears) {
    const existing = db.prepare('SELECT id FROM academic_years WHERE name = ?').get(yearData.name) as any;
    if (!existing) {
      const yearId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO academic_years (id, name, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(yearId, yearData.name, yearData.startDate, yearData.endDate, yearData.isActive);
      console.log(`✅ Academic year created: ${yearData.name}${yearData.isActive === 1 ? ' (Active)' : ''}`);
      createdCount++;
      if (yearData.isActive === 1) {
        academicYearId = yearId;
      }
    } else {
      if (yearData.isActive === 1) {
        academicYearId = existing.id;
      }
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
      } else {
        // Create it if it doesn't exist
        academicYearId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO academic_years (id, name, start_date, end_date, is_active)
          VALUES (?, ?, ?, ?, ?)
        `).run(academicYearId, '2024/2025', '2024-07-01', '2025-06-30', 1);
      }
    } else {
      academicYearId = activeYears[0].id;
    }
  } catch (error) {
    console.log('⚠️  Error managing active academic year:', error);
    // Fallback: get any active year or create 2024/2025
    const fallbackYear = db.prepare('SELECT id FROM academic_years WHERE is_active = 1 LIMIT 1').get() as any;
    if (fallbackYear) {
      academicYearId = fallbackYear.id;
    } else {
      academicYearId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO academic_years (id, name, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?)
      `).run(academicYearId, '2024/2025', '2024-07-01', '2025-06-30', 1);
    }
  }
  
  console.log(`✅ Master academic years seeding completed (${createdCount} new years created)`);

  // Seed Master Classes
  console.log('\n📚 Seeding master classes...');
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

  let createdCount = 0;
  for (const classData of masterClasses) {
    const existing = db.prepare('SELECT id FROM classes WHERE name = ? AND school_level = ?').get(classData.name, classData.schoolLevel) as any;
    if (!existing) {
      const classId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO classes (id, name, grade, school_level, homeroom_teacher_id, academic_year, semester)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(classId, classData.name, classData.grade, classData.schoolLevel, null, academicYearId, 1);
      console.log(`✅ Class created: ${classData.name} (${classData.schoolLevel.toUpperCase()})`);
      createdCount++;
    }
  }
  console.log(`✅ Master classes seeding completed (${createdCount} new classes created)`);

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

  console.log('\n✅ Database seeding completed!');
  console.log('\n📋 Default Credentials:');
  console.log('   Username: student | Password: password');
  console.log('   Username: teacher | Password: password');
  console.log('   Username: admin   | Password: password');
  console.log('   Username: parent  | Password: password');
}

ensureSeed().catch(console.error);
