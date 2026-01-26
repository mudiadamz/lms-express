# 🔍 Check Password Hash Issue

## Problem

Users exist in database but login still fails with "Invalid username or password".

**Possible causes:**
1. Password hash is corrupted or incorrect
2. Password wasn't hashed during seed
3. Hash comparison is failing

## Solution: Verify and Fix Password Hashes

### Step 1: Check Password Hash Format

In Railway shell, check if passwords are hashed:

```bash
sqlite3 database/lms.db "SELECT username, substr(password, 1, 30) as pwd_preview FROM users WHERE username = 'student';"
```

**Expected**: Should show a bcrypt hash starting with `$2a$` or `$2b$`:
```
student|$2a$10$abcdefghijklmnopqrstuv
```

**If shows plain text**: Password wasn't hashed, need to re-seed

**If shows different format**: Hash might be corrupted

### Step 2: Check All Users

```bash
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash_start FROM users;"
```

All should start with `$2a$` or `$2b$`.

### Step 3: Re-seed with Fresh Hashes

If passwords aren't hashed correctly:

```bash
# Delete existing users
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"

# Re-run seed
npm run seed
```

### Step 4: Verify Hash After Re-seed

```bash
sqlite3 database/lms.db "SELECT username, substr(password, 1, 30) as hash FROM users WHERE username = 'student';"
```

Should show proper bcrypt hash.

### Step 5: Test Login

```bash
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## Alternative: Manual Password Hash Fix

If re-seeding doesn't work, manually update password hash:

```bash
# In Railway shell, use Node.js to hash password
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('password', 10).then(hash => console.log(hash));"
```

Copy the hash output, then:

```bash
sqlite3 database/lms.db "UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'student';"
```

Repeat for all users.

## Debug: Check Seed Script

Verify seed script is running correctly:

```bash
# Run seed with verbose output
npm run seed

# Check for errors
# Should see: "✅ Password hash created"
```

## Common Issues

### Issue 1: Password Hash Missing `$2a$` prefix
**Fix**: Re-run seed script

### Issue 2: Password is Plain Text
**Fix**: Delete users and re-seed:
```bash
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed
```

### Issue 3: Hash Comparison Failing
**Check**: Verify bcryptjs version matches
```bash
npm list bcryptjs
```

Should be `^2.4.3` or similar.

## Quick Fix Script

Run this in Railway shell:

```bash
# Check current state
echo "=== Checking users ==="
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash FROM users;"

# Delete and re-seed
echo "=== Re-seeding ==="
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed

# Verify
echo "=== Verifying ==="
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash FROM users;"
```

All hashes should start with `$2a$` or `$2b$`.
