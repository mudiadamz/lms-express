import db from './db.js';
import bcrypt from 'bcryptjs';

async function fixPasswords() {
  console.log('🔧 Fixing password hashes...\n');

  const users = db.prepare('SELECT id, username, password FROM users WHERE username IN (?, ?, ?, ?)').all('student', 'teacher', 'admin', 'parent') as any[];

  if (users.length === 0) {
    console.log('❌ No users found. Run seed script first.');
    return;
  }

  const correctPassword = 'password';
  const hashedPassword = await bcrypt.hash(correctPassword, 10);

  console.log('✅ Generated password hash:', hashedPassword.substring(0, 30) + '...\n');

  for (const user of users) {
    console.log(`Checking user: ${user.username}`);
    console.log(`  Current hash start: ${user.password ? user.password.substring(0, 10) : 'NULL'}`);
    
    // Check if password is already a bcrypt hash
    const isBcryptHash = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'));
    
    if (!isBcryptHash) {
      console.log(`  ⚠️  Invalid hash format. Updating...`);
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
      console.log(`  ✅ Updated password for ${user.username}\n`);
    } else {
      // Verify the hash works
      try {
        const isValid = await bcrypt.compare(correctPassword, user.password);
        if (!isValid) {
          console.log(`  ⚠️  Hash doesn't match "password". Updating...`);
          db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
          console.log(`  ✅ Updated password for ${user.username}\n`);
        } else {
          console.log(`  ✅ Password hash is valid\n`);
        }
      } catch (error: any) {
        console.log(`  ❌ Error verifying hash: ${error.message}`);
        console.log(`  ⚠️  Updating hash...`);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);
        console.log(`  ✅ Updated password for ${user.username}\n`);
      }
    }
  }

  // Verify all passwords after update
  console.log('🔍 Verifying all passwords after update...\n');
  for (const user of users) {
    const updatedUser = db.prepare('SELECT password FROM users WHERE id = ?').get(user.id) as any;
    try {
      const isValid = await bcrypt.compare(correctPassword, updatedUser.password);
      const status = isValid ? '✅' : '❌';
      console.log(`  ${status} ${user.username}: ${isValid ? 'Valid' : 'Invalid'}`);
    } catch (error: any) {
      console.log(`  ❌ ${user.username}: Error - ${error.message}`);
    }
  }

  console.log('');
  console.log('✅ Password fix completed!');
  console.log('');
  console.log('Test login with:');
  console.log('- Username: student');
  console.log('- Password: password');
  console.log('');
  console.log('Or run: npm run test-login');
}

fixPasswords().catch(console.error);
