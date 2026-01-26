# 🔧 Fix: "Invalid username or password" Even Though Users Exist

## Problem

Users exist in database (`SELECT username FROM users` returns results), but login still fails.

**Cause**: Password hash is incorrect, corrupted, or missing.

## Quick Fix

### Step 1: Check Password Hash Format

In Railway shell:

```bash
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash_start FROM users WHERE username = 'student';"
```

**Expected**: Should show `$2a$10$` or `$2b$10$` (bcrypt hash)

**If shows**: Plain text or different format → Password wasn't hashed correctly

### Step 2: Fix Password Hashes

Run the fix script:

```bash
npm run fix-passwords
```

This will:
- Check all default users (student, teacher, admin, parent)
- Verify password hashes are valid bcrypt hashes
- Update any invalid hashes with correct bcrypt hash for `password`

### Step 3: Verify Fix

```bash
# Check hash format
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash FROM users;"

# All should show: $2a$10$ or $2b$10$
```

### Step 4: Test Login

```bash
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

Should return `success: true` with user data and token.

## Alternative: Manual Fix

If `npm run fix-passwords` doesn't work:

### Option 1: Delete and Re-seed

```bash
# Delete existing users
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"

# Re-seed
npm run seed
```

### Option 2: Manual Hash Update

```bash
# Generate hash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('password', 10).then(hash => console.log(hash));"
```

Copy the hash output, then update each user:

```bash
sqlite3 database/lms.db "UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'student';"
sqlite3 database/lms.db "UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'teacher';"
sqlite3 database/lms.db "UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'admin';"
sqlite3 database/lms.db "UPDATE users SET password = 'PASTE_HASH_HERE' WHERE username = 'parent';"
```

## Diagnostic Commands

Run these in Railway shell to diagnose:

```bash
# 1. Check if users exist
sqlite3 database/lms.db "SELECT username, role FROM users;"

# 2. Check password hash format
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) as hash FROM users WHERE username = 'student';"

# 3. Check password length (bcrypt hashes are ~60 chars)
sqlite3 database/lms.db "SELECT username, length(password) as pwd_len FROM users WHERE username = 'student';"
# Should be around 60 characters

# 4. Verify hash starts with $2a$ or $2b$
sqlite3 database/lms.db "SELECT username, CASE WHEN password LIKE '\$2a\$%' OR password LIKE '\$2b\$%' THEN 'Valid' ELSE 'Invalid' END as hash_status FROM users;"
```

## Common Issues

### Issue 1: Password Hash is Plain Text
**Symptom**: `SELECT password FROM users` shows `password` instead of hash
**Fix**: Run `npm run fix-passwords` or re-seed

### Issue 2: Password Hash is Wrong Format
**Symptom**: Hash doesn't start with `$2a$` or `$2b$`
**Fix**: Run `npm run fix-passwords`

### Issue 3: Password Hash is Corrupted
**Symptom**: Hash looks correct but `bcrypt.compare` fails
**Fix**: Run `npm run fix-passwords` to regenerate

### Issue 4: Seed Script Didn't Hash Passwords
**Symptom**: Users exist but passwords are plain text
**Fix**: 
```bash
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed
```

## Expected Output After Fix

After running `npm run fix-passwords`:

```
🔧 Fixing password hashes...
✅ Generated password hash: $2a$10$EHVvvVzABVXMvwLZ80I9xOD...
✅ User student password hash is valid
✅ User teacher password hash is valid
✅ User admin password hash is valid
✅ User parent password hash is valid

✅ Password fix completed!

Test login with:
- Username: student
- Password: password
```

## Verify Login Works

After fixing, test:

```bash
# Test student
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Should return:
# {
#   "success": true,
#   "data": {
#     "user": { ... },
#     "token": "..."
#   }
# }
```

## Summary

1. **Check hash format**: `sqlite3 database/lms.db "SELECT substr(password, 1, 10) FROM users WHERE username = 'student';"`
2. **Fix passwords**: `npm run fix-passwords`
3. **Verify**: Check hash format again
4. **Test**: Try login

If still failing, check Railway logs for detailed error messages.
