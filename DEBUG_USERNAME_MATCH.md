# 🔍 Debug: Users Exist in SQLite3 But Login Fails

## Problem

Users exist when checked via `sqlite3` console:
```bash
sqlite3 database/lms.db "SELECT username FROM users;"
# Shows: student, teacher, admin, parent
```

But login still fails with "User not found".

## Possible Causes

1. **Username Case Sensitivity** - Database has `Admin` but searching for `admin`
2. **Whitespace Issues** - Username has leading/trailing spaces
3. **Database Path Mismatch** - Server using different database file
4. **Query Issue** - SQL query not matching correctly

## Fix Applied

Enhanced auth route with:
- ✅ Multiple matching strategies (exact, case-insensitive, without trim)
- ✅ Detailed debugging output showing:
  - Original username input
  - Trimmed username
  - Hex representation (to detect hidden characters)
  - All users in database with their exact format

## Test After Deployment

### Step 1: Check Railway Logs

After making a login request, check logs:

```bash
railway logs --tail 50
```

Look for:
```
🔍 Searching for user: { original: 'admin', trimmed: 'admin', ... }
📋 All users in database:
   - "admin" (length: 5)
```

### Step 2: Compare Usernames

Compare the username in logs with what's in database:

```bash
railway shell
sqlite3 database/lms.db "SELECT username, LENGTH(username) as len, hex(username) as hex FROM users;"
```

Check:
- **Length** - Should match (e.g., "admin" = 5)
- **Hex** - Should match (e.g., "admin" = 61646d696e)
- **Case** - Should match exactly

### Step 3: Fix Username Issues

If usernames don't match:

**Option A: Fix in Database**
```bash
railway shell
sqlite3 database/lms.db "UPDATE users SET username = LOWER(TRIM(username)) WHERE username IN ('student', 'teacher', 'admin', 'parent');"
```

**Option B: Re-seed**
```bash
railway shell
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run ensure-seed
```

### Step 4: Verify Database Path

Make sure server is using the same database:

```bash
railway shell
# Check what database server is using
grep -r "Database connected" . 2>/dev/null || echo "Check Railway logs"

# Check database path
echo $DB_PATH
ls -la database/
```

## Expected Log Output

After fix, successful login should show:
```
🔐 Login attempt: { username: 'admin', passwordLength: 8 }
🔍 Searching for user: { original: 'admin', trimmed: 'admin', trimmedLength: 5, trimmedHex: '61646d696e' }
✅ User found: admin Role: admin
🔍 Password hash check: { hashLength: 60, hashStart: '$2a$10$', isBcrypt: true }
🔐 Password comparison result: true
✅ Login successful for: admin
```

## Manual Database Check

Run this in Railway shell to verify:

```bash
# Check exact username format
sqlite3 database/lms.db "SELECT username, LENGTH(username) as len, hex(username) as hex FROM users WHERE username LIKE '%admin%';"

# Check all users
sqlite3 database/lms.db "SELECT username, role FROM users;"

# Test exact match
sqlite3 database/lms.db "SELECT username FROM users WHERE username = 'admin';"

# Test case-insensitive
sqlite3 database/lms.db "SELECT username FROM users WHERE LOWER(username) = 'admin';"
```

## Quick Fix Script

If usernames have issues, run:

```bash
railway shell

# Normalize all usernames (lowercase, trim)
sqlite3 database/lms.db "
UPDATE users SET username = LOWER(TRIM(username)) 
WHERE username IN ('student', 'teacher', 'admin', 'parent');
"

# Verify
sqlite3 database/lms.db "SELECT username FROM users;"

exit
```

## Status

- ✅ Enhanced username matching with multiple strategies
- ✅ Added detailed debugging output
- ✅ Code pushed to git
- ⏳ Waiting for Railway deployment
- 🧪 After deployment, check logs to see exact username format
