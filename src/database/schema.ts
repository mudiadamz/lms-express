import db from './db.js';

export function createTables() {
  try {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      student_number TEXT UNIQUE,
      teacher_number TEXT UNIQUE,
      admin_number TEXT UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('student', 'teacher', 'admin', 'parent')),
      school_level TEXT CHECK(school_level IN ('sd', 'smp', 'sma')),
      class_id TEXT,
      student_id TEXT,
      avatar TEXT,
      phone_number TEXT,
      gender TEXT CHECK(gender IN ('male', 'female')),
      birth_place TEXT,
      birth_date TEXT,
      kk_file TEXT,
      ktp_file TEXT,
      photo_file TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES users(id)
    )
  `);

  // Migration: Add gender column if it doesn't exist
  try {
    const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
    const hasGender = columns.some((col: any) => col.name === 'gender');
    if (!hasGender) {
      db.exec(`ALTER TABLE users ADD COLUMN gender TEXT CHECK(gender IN ('male', 'female'))`);
    }
  } catch (migrationError: any) {
    console.error('Migration error (gender):', migrationError?.message);
  }

  // Classes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      grade INTEGER NOT NULL,
      school_level TEXT NOT NULL CHECK(school_level IN ('sd', 'smp', 'sma')),
      homeroom_teacher_id TEXT,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (homeroom_teacher_id) REFERENCES users(id)
    )
  `);

  // Class Students junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_students (
      class_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      PRIMARY KEY (class_id, student_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Subjects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      school_level TEXT NOT NULL CHECK(school_level IN ('sd', 'smp', 'sma')),
      teacher_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Class Subjects junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS class_subjects (
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      PRIMARY KEY (class_id, subject_id),
      FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    )
  `);

  // Migration: allow subjects.teacher_id to be nullable
  try {
    const subjectColumns = db.prepare("PRAGMA table_info(subjects)").all() as any[];
    const teacherIdColumn = subjectColumns.find((col: any) => col.name === 'teacher_id');
    if (teacherIdColumn && teacherIdColumn.notnull === 1) {
      console.log('🔄 Migrating subjects table: allow teacher_id NULL...');
      db.exec('PRAGMA foreign_keys = OFF');
      db.exec(`
        CREATE TABLE subjects_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          description TEXT,
          school_level TEXT NOT NULL CHECK(school_level IN ('sd', 'smp', 'sma')),
          teacher_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (teacher_id) REFERENCES users(id)
        )
      `);
      db.exec(`
        INSERT INTO subjects_new (id, name, code, description, school_level, teacher_id, created_at)
        SELECT id, name, code, description, school_level, teacher_id, created_at FROM subjects
      `);
      db.exec(`DROP TABLE subjects`);
      db.exec(`ALTER TABLE subjects_new RENAME TO subjects`);
      db.exec('PRAGMA foreign_keys = ON');
      console.log('✅ Migration completed: subjects.teacher_id is now nullable');
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error (subjects.teacher_id nullable):', migrationError?.message);
  }

  // Assignments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      start_date DATETIME,
      due_date DATETIME NOT NULL,
      max_score REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Migration: Add start_date column to assignments if it doesn't exist
  try {
    const assignmentColumns = db.prepare("PRAGMA table_info(assignments)").all() as any[];
    const hasStartDate = assignmentColumns.some((col: any) => col.name === 'start_date');
    if (!hasStartDate) {
      console.log('🔄 Migrating assignments table: adding start_date column...');
      db.exec('ALTER TABLE assignments ADD COLUMN start_date DATETIME');
      db.exec('UPDATE assignments SET start_date = created_at WHERE start_date IS NULL');
      console.log('✅ Migration completed: assignments.start_date added');
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error (assignments.start_date):', migrationError?.message);
  }

  // Assignment Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignment_attachments (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
    )
  `);

  // Assignment Submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assignment_submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      content TEXT NOT NULL,
      score REAL,
      feedback TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      graded_at DATETIME,
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id),
      UNIQUE(assignment_id, student_id)
    )
  `);

  // Submission Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS submission_attachments (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES assignment_submissions(id) ON DELETE CASCADE
    )
  `);

  // Quizzes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      time_limit INTEGER,
      start_date DATETIME NOT NULL,
      end_date DATETIME NOT NULL,
      max_score REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Quiz Questions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      question TEXT NOT NULL,
      question_image TEXT,
      type TEXT NOT NULL CHECK(type IN ('multiple_choice', 'essay', 'true_false', 'short_answer')),
      options TEXT,
      correct_answer TEXT NOT NULL,
      points REAL NOT NULL,
      question_order INTEGER NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add question_image column to quiz_questions if it doesn't exist
  try {
    const quizQuestionColumns = db.prepare("PRAGMA table_info(quiz_questions)").all() as any[];
    const hasQuestionImage = quizQuestionColumns.some((col: any) => col.name === 'question_image');
    if (!hasQuestionImage) {
      console.log('🔄 Migrating quiz_questions table: adding question_image column...');
      db.exec('ALTER TABLE quiz_questions ADD COLUMN question_image TEXT');
      console.log('✅ Migration completed: quiz_questions.question_image added');
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error (quiz_questions.question_image):', migrationError?.message);
  }

  // Quiz Submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_submissions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      score REAL,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      graded_at DATETIME,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES users(id),
      UNIQUE(quiz_id, student_id)
    )
  `);

  // Quiz Answers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_answers (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      FOREIGN KEY (submission_id) REFERENCES quiz_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id)
    )
  `);

  // Materials table
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('video', 'document', 'presentation', 'link', 'other')),
      subject_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      file_url TEXT,
      external_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Material Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_attachments (
      id TEXT PRIMARY KEY,
      material_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
    )
  `);

  // Grades table
  db.exec(`
    CREATE TABLE IF NOT EXISTS grades (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      assignment_id TEXT,
      quiz_id TEXT,
      score REAL NOT NULL,
      max_score REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('assignment', 'quiz', 'midterm', 'final', 'other')),
      teacher_id TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id),
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Report Cards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS report_cards (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      average_score REAL NOT NULL,
      rank INTEGER,
      teacher_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  // Attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      date DATE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
      notes TEXT,
      recorded_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (recorded_by) REFERENCES users(id),
      UNIQUE(student_id, class_id, subject_id, date)
    )
  `);

  // Schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      teacher_id TEXT NOT NULL,
      day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT,
      academic_year TEXT NOT NULL,
      semester INTEGER NOT NULL,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subject_id) REFERENCES subjects(id),
      FOREIGN KEY (teacher_id) REFERENCES users(id)
    )
  `);

  // Forum Posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  // Forum Post Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS forum_post_attachments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
    )
  `);

  // Forum Comments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS forum_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      subject TEXT,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    )
  `);

  // Message Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
    )
  `);

  // Notifications table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('assignment', 'quiz', 'grade', 'announcement', 'message', 'attendance', 'other')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Announcements table
  db.exec(`
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      class_id TEXT,
      is_pinned INTEGER DEFAULT 0,
      start_date DATETIME NOT NULL,
      end_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  // Announcement Attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS announcement_attachments (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE
    )
  `);

  // Academic Years table
  db.exec(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      amount REAL NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue', 'verifying')),
      payment_method TEXT,
      receipt_number TEXT,
      receipt_file_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  // Migration: Add student_id column if it doesn't exist (for existing databases)
  try {
    const columns = db.prepare("PRAGMA table_info(payments)").all() as any[];
    const hasStudentId = columns.some((col: any) => col.name === 'student_id');
    
    if (!hasStudentId) {
      console.log('🔄 Migrating payments table: adding student_id column...');
      
      // Check if there are existing payments
      const existingPayments = db.prepare('SELECT COUNT(*) as count FROM payments').get() as any;
      
      if (existingPayments.count > 0) {
        // If there are existing payments, we need to recreate the table
        // Step 1: Create new table with student_id
        db.exec(`
          CREATE TABLE payments_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            class_id TEXT,
            month TEXT NOT NULL,
            year INTEGER NOT NULL,
            amount REAL NOT NULL,
            due_date DATE NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue', 'verifying')),
            payment_method TEXT,
            receipt_number TEXT,
            receipt_file_url TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (class_id) REFERENCES classes(id)
          )
        `);
        
        // Step 2: Migrate existing payments by assigning a student from each class
        // For each payment, find a student in that class
        const oldPayments = db.prepare('SELECT * FROM payments').all() as any[];
        
        for (const payment of oldPayments) {
          if (payment.class_id) {
            // Find a student in this class
            const student = db.prepare(`
              SELECT id FROM users 
              WHERE class_id = ? AND role = 'student' 
              LIMIT 1
            `).get(payment.class_id) as any;
            
            if (student) {
              // Insert into new table with student_id
              db.prepare(`
                INSERT INTO payments_new (id, student_id, class_id, month, year, amount, due_date, status, payment_method, receipt_number, receipt_file_url, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                payment.id,
                student.id,
                payment.class_id,
                payment.month,
                payment.year,
                payment.amount,
                payment.due_date,
                payment.status,
                payment.payment_method || null,
                payment.receipt_number || null,
                payment.receipt_file_url || null,
                payment.notes || null,
                payment.created_at || new Date().toISOString()
              );
            }
          }
        }
        
        // Step 3: Drop old table and rename new one
        db.exec(`DROP TABLE payments`);
        db.exec(`ALTER TABLE payments_new RENAME TO payments`);
        
        console.log('✅ Migration completed: payments table updated with student_id');
      } else {
        // No existing payments, just drop and recreate
        db.exec(`DROP TABLE IF EXISTS payments`);
        db.exec(`
          CREATE TABLE payments (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            class_id TEXT,
            month TEXT NOT NULL,
            year INTEGER NOT NULL,
            amount REAL NOT NULL,
            due_date DATE NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue', 'verifying')),
            payment_method TEXT,
            receipt_number TEXT,
            receipt_file_url TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (class_id) REFERENCES classes(id)
          )
        `);
        console.log('✅ Migration completed: payments table recreated with student_id');
      }
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error:', migrationError?.message);
    console.error('Migration stack:', migrationError?.stack);
    // Don't throw - let the app continue, but log the error
  }

  // Migration: Add receipt_file_url column if it doesn't exist
  try {
    const columns = db.prepare("PRAGMA table_info(payments)").all() as any[];
    const hasReceiptFileUrl = columns.some((col: any) => col.name === 'receipt_file_url');
    
    if (!hasReceiptFileUrl) {
      console.log('🔄 Migrating payments table: adding receipt_file_url column...');
      db.exec(`ALTER TABLE payments ADD COLUMN receipt_file_url TEXT`);
      console.log('✅ Migration completed: payments table updated with receipt_file_url');
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error for receipt_file_url:', migrationError?.message);
  }

  // Migration: Update CHECK constraint to allow 'verifying' status
  try {
    console.log('🔄 Checking if payments table needs status migration...');
    // SQLite doesn't support ALTER COLUMN, so we need to recreate the table
    const testInsert = db.prepare(`
      SELECT id FROM payments WHERE status = 'verifying' LIMIT 1
    `);
    
    try {
      testInsert.get();
      console.log('✅ Payments table already supports verifying status');
    } catch (checkError: any) {
      if (checkError.message.includes('CHECK constraint')) {
        console.log('🔄 Migrating payments table to support verifying status...');
        db.exec('PRAGMA foreign_keys = OFF');
        db.exec(`
          CREATE TABLE payments_new (
            id TEXT PRIMARY KEY,
            student_id TEXT NOT NULL,
            class_id TEXT,
            month TEXT NOT NULL,
            year INTEGER NOT NULL,
            amount REAL NOT NULL,
            due_date DATE NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('paid', 'pending', 'overdue', 'verifying')),
            payment_method TEXT,
            receipt_number TEXT,
            receipt_file_url TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES users(id),
            FOREIGN KEY (class_id) REFERENCES classes(id)
          )
        `);
        db.exec(`
          INSERT INTO payments_new 
          SELECT * FROM payments
        `);
        db.exec(`DROP TABLE payments`);
        db.exec(`ALTER TABLE payments_new RENAME TO payments`);
        db.exec('PRAGMA foreign_keys = ON');
        console.log('✅ Migration completed: payments table now supports verifying status');
      }
    }
  } catch (migrationError: any) {
    console.error('❌ Migration error for verifying status:', migrationError?.message);
  }

  // Curriculums table
  db.exec(`
    CREATE TABLE IF NOT EXISTS curriculums (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      school_level TEXT NOT NULL CHECK(school_level IN ('sd', 'smp', 'sma', 'all')),
      is_active INTEGER DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Audit Logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Settings table (single row for system-wide settings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY DEFAULT 'system',
      school_name TEXT NOT NULL DEFAULT 'LMS Sekolah',
      address TEXT DEFAULT '',
      school_level TEXT CHECK(school_level IN ('sd', 'smp', 'sma', '')),
      dark_mode INTEGER DEFAULT 0,
      payment_default_amount REAL DEFAULT 0,
      payment_default_due_day INTEGER DEFAULT 1,
      payment_auto_generate INTEGER DEFAULT 0,
      bank_name TEXT DEFAULT '',
      account_holder_name TEXT DEFAULT '',
      account_number TEXT DEFAULT '',
      payment_methods TEXT DEFAULT '[]',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  // Migration: Add payment and bank columns if they don't exist
  try {
    const columns = db.prepare("PRAGMA table_info(settings)").all() as any[];
    const columnNames = columns.map((col: any) => col.name);
    
    if (!columnNames.includes('payment_default_amount')) {
      db.exec(`ALTER TABLE settings ADD COLUMN payment_default_amount REAL DEFAULT 0`);
    }
    if (!columnNames.includes('payment_default_due_day')) {
      db.exec(`ALTER TABLE settings ADD COLUMN payment_default_due_day INTEGER DEFAULT 1`);
    }
    if (!columnNames.includes('payment_auto_generate')) {
      db.exec(`ALTER TABLE settings ADD COLUMN payment_auto_generate INTEGER DEFAULT 0`);
    }
    if (!columnNames.includes('bank_name')) {
      db.exec(`ALTER TABLE settings ADD COLUMN bank_name TEXT DEFAULT ''`);
    }
    if (!columnNames.includes('account_holder_name')) {
      db.exec(`ALTER TABLE settings ADD COLUMN account_holder_name TEXT DEFAULT ''`);
    }
    if (!columnNames.includes('account_number')) {
      db.exec(`ALTER TABLE settings ADD COLUMN account_number TEXT DEFAULT ''`);
    }
    if (!columnNames.includes('payment_methods')) {
      db.exec(`ALTER TABLE settings ADD COLUMN payment_methods TEXT DEFAULT '[]'`);
    }
  } catch (migrationError: any) {
    console.error('Migration error (this is OK if columns already exist):', migrationError?.message);
  }

  // User Settings table (for per-user settings like dark mode preference)
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      dark_mode INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    console.log('Database tables created successfully');
  } catch (error: any) {
    // If tables already exist, that's okay
    if (error.message && error.message.includes('already exists')) {
      console.log('Tables already exist, skipping creation');
      return;
    }
    // Re-throw other errors
    console.error('Error creating tables:', error);
    throw error;
  }
}
