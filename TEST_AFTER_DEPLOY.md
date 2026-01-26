# 🧪 Test After Deploy

## Changes Made

1. ✅ Added debug logging to auth route
2. ✅ Improved username matching (case-insensitive, trimmed)
3. ✅ Better error messages and logging

## Test After Railway Deploys

### Step 1: Wait for Deployment

Railway will auto-deploy after git push. Check Railway Dashboard for deployment status.

### Step 2: Check Railway Logs

```bash
railway logs
```

Look for:
- "🔐 Login attempt:" messages
- "✅ User found:" or "❌ User not found:" messages
- Password hash information
- Password comparison results

### Step 3: Test Login

```bash
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

### Step 4: Check Logs for Debug Info

After the curl request, check Railway logs:

```bash
railway logs --tail 50
```

You should see:
```
🔐 Login attempt: { username: 'student', passwordLength: 8 }
✅ User found: student Role: student
🔍 Password hash check: { hashLength: 60, hashStart: '$2a$10$', isBcrypt: true }
🔐 Password comparison result: true
✅ Login successful for: student
```

### Step 5: If Still Failing

Based on logs, identify the issue:

**If "User not found":**
- Run: `npm run seed` in Railway shell
- Or check: `sqlite3 database/lms.db "SELECT username FROM users;"`

**If "Password hash check" shows invalid hash:**
- Run: `npm run fix-passwords` in Railway shell

**If "Password comparison result: false":**
- Password hash doesn't match
- Run: `npm run fix-passwords` again

## Expected Response

Success response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "student",
      "fullName": "Budi Santoso",
      "role": "student",
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

## Next Steps

1. Wait for Railway to finish deploying (~2-3 minutes)
2. Test with curl command above
3. Check Railway logs for debug output
4. Fix any issues found in logs
5. Re-test until login works
