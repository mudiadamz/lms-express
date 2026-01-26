# 🐛 Debug: "Invalid username or password" After Fix

## Problem

Even after running `npm run fix-passwords`, login still fails.

## Diagnostic Steps

### Step 1: Run Diagnostic Script

```bash
npm run test-login
```

This will:
- Check if user exists
- Verify password hash format
- Test password comparison directly
- Show exact username and password hash

### Step 2: Check Exact Username

The username must match EXACTLY (case-sensitive, no spaces):

```bash
# Check exact username in database
sqlite3 database/lms.db "SELECT username, length(username) as len FROM users WHERE username = 'student';"

# Check for hidden characters
sqlite3 database/lms.db "SELECT hex(username) FROM users WHERE username = 'student';"
```

### Step 3: Verify Request Format

Check how you're sending the login request:

**Correct:**
```json
{
  "username": "student",
  "password": "password"
}
```

**Wrong:**
```json
{
  "email": "student",  // ❌ Wrong field name
  "password": "password"
}
```

```json
{
  "username": "Student",  // ❌ Wrong case
  "password": "password"
}
```

```json
{
  "username": " student ",  // ❌ Extra spaces
  "password": "password"
}
```

### Step 4: Test with curl

```bash
# Test exact request
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}' \
  -v

# Check response headers and body
```

### Step 5: Check Railway Logs

```bash
railway logs
```

Look for:
- Login attempts
- Error messages
- Database queries

## Common Issues

### Issue 1: Username Has Extra Spaces

**Check:**
```bash
sqlite3 database/lms.db "SELECT '[' || username || ']' as username FROM users WHERE username LIKE '%student%';"
```

**Fix:**
```bash
sqlite3 database/lms.db "UPDATE users SET username = TRIM(username) WHERE username IN ('student', 'teacher', 'admin', 'parent');"
```

### Issue 2: Case Sensitivity

Username `Student` vs `student` - must be lowercase `student`

**Check:**
```bash
sqlite3 database/lms.db "SELECT username FROM users WHERE LOWER(username) = 'student';"
```

**Fix:** Use exact lowercase username in login request

### Issue 3: Wrong Request Body Format

Make sure you're sending:
- Field name: `username` (not `email` or `user`)
- Field name: `password` (not `pass` or `pwd`)

### Issue 4: Database Path Issue

Check if server is using correct database:

```bash
# In Railway shell
echo $DB_PATH
ls -la database/
```

### Issue 5: Password Hash Still Wrong

Even after fix-passwords, verify:

```bash
# Check hash format
sqlite3 database/lms.db "SELECT username, substr(password, 1, 10) FROM users WHERE username = 'student';"

# Should show: $2a$10$ or $2b$10$

# Test hash directly
node -e "const bcrypt = require('bcryptjs'); const hash = 'PASTE_HASH_HERE'; bcrypt.compare('password', hash).then(result => console.log('Match:', result));"
```

## Manual Test Script

Run this in Railway shell:

```bash
# 1. Check user exists
echo "=== Checking user ==="
sqlite3 database/lms.db "SELECT username, role FROM users WHERE username = 'student';"

# 2. Check password hash
echo "=== Checking password hash ==="
sqlite3 database/lms.db "SELECT substr(password, 1, 10) as hash_start, length(password) as len FROM users WHERE username = 'student';"

# 3. Run diagnostic
echo "=== Running diagnostic ==="
npm run test-login

# 4. Test password comparison
echo "=== Testing password ==="
node -e "
const bcrypt = require('bcryptjs');
const db = require('better-sqlite3')('database/lms.db');
const user = db.prepare('SELECT password FROM users WHERE username = ?').get('student');
if (user) {
  bcrypt.compare('password', user.password).then(result => {
    console.log('Password match:', result);
    process.exit(result ? 0 : 1);
  });
} else {
  console.log('User not found');
  process.exit(1);
}
"
```

## Expected Output from test-login

```
🔍 Testing login credentials...

✅ User found:
   ID: abc-123-def
   Username: "student"
   Role: student
   Full Name: Budi Santoso
   Password Hash Length: 60
   Password Hash Start: $2a$10$

✅ Password is a valid bcrypt hash

🔐 Testing password comparison...
   Input password: "password"
   Stored hash: $2a$10$EHVvvVzABVXMvwLZ80I9xOD...

✅ Password comparison: SUCCESS
   The password hash is correct!

💡 If login still fails, check:
   1. Request body format (username vs email)
   2. Case sensitivity (username must be exact)
   3. Extra spaces in username/password
   4. API endpoint URL
```

## If test-login Shows Success But Login Still Fails

1. **Check API endpoint**: Make sure you're hitting `/api/auth/login` (not `/auth/login` or `/login`)
2. **Check request headers**: Must include `Content-Type: application/json`
3. **Check request body**: Must be valid JSON
4. **Check Railway logs**: Look for actual error messages

## Final Check: Test Direct API Call

```bash
# Exact curl command
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}' \
  -w "\nHTTP Status: %{http_code}\n"
```

Should return:
- HTTP Status: 200
- JSON with `success: true`

If it returns 401, check Railway logs for exact error.
