import db from './db.js';
import bcrypt from 'bcryptjs';

async function testLogin() {
  console.log('🔍 Testing login credentials...\n');

  const testUsername = 'student';
  const testPassword = 'password';

  // Get user from database
  const user = db.prepare(`
    SELECT id, username, password, role, full_name
    FROM users
    WHERE username = ?
  `).get(testUsername) as any;

  if (!user) {
    console.log('❌ User not found:', testUsername);
    console.log('\nAvailable users:');
    const allUsers = db.prepare('SELECT username, role FROM users').all() as any[];
    allUsers.forEach(u => console.log(`  - ${u.username} (${u.role})`));
    return;
  }

  console.log('✅ User found:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Username: "${user.username}"`);
  console.log(`   Role: ${user.role}`);
  console.log(`   Full Name: ${user.full_name}`);
  console.log(`   Password Hash Length: ${user.password.length}`);
  console.log(`   Password Hash Start: ${user.password.substring(0, 10)}`);

  // Check if password is a valid bcrypt hash
  const isBcryptHash = user.password.startsWith('$2a$') || 
                        user.password.startsWith('$2b$') || 
                        user.password.startsWith('$2y$');

  if (!isBcryptHash) {
    console.log('\n❌ Password is NOT a valid bcrypt hash!');
    console.log(`   Hash starts with: "${user.password.substring(0, 10)}"`);
    console.log('   Expected: $2a$10$ or $2b$10$');
    return;
  }

  console.log('\n✅ Password is a valid bcrypt hash');

  // Test password comparison
  console.log(`\n🔐 Testing password comparison...`);
  console.log(`   Input password: "${testPassword}"`);
  console.log(`   Stored hash: ${user.password.substring(0, 30)}...`);

  try {
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    if (isValid) {
      console.log('\n✅ Password comparison: SUCCESS');
      console.log('   The password hash is correct!');
      console.log('\n💡 If login still fails, check:');
      console.log('   1. Request body format (username vs email)');
      console.log('   2. Case sensitivity (username must be exact)');
      console.log('   3. Extra spaces in username/password');
      console.log('   4. API endpoint URL');
    } else {
      console.log('\n❌ Password comparison: FAILED');
      console.log('   The password hash does not match "password"');
      console.log('\n💡 Try running: npm run fix-passwords');
    }
  } catch (error: any) {
    console.log('\n❌ Error comparing password:', error.message);
    console.log('   Stack:', error.stack);
  }

  // Test all default users
  console.log('\n\n📋 Testing all default users:');
  const defaultUsers = ['student', 'teacher', 'admin', 'parent'];
  
  for (const username of defaultUsers) {
    const u = db.prepare('SELECT username, password FROM users WHERE username = ?').get(username) as any;
    if (u) {
      const isValid = await bcrypt.compare('password', u.password);
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} ${username}: ${isValid ? 'Valid' : 'Invalid hash'}`);
    } else {
      console.log(`   ⚠️  ${username}: Not found`);
    }
  }
}

testLogin().catch(console.error);
