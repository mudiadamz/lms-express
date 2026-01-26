# 🚀 Quick Fix: Empty Database

## Problem

Railway logs show:
```
❌ User not found: admin
Available users: []
```

**Root Cause**: Database is empty - no users have been seeded.

## Immediate Fix

### Option 1: Run Ensure-Seed Script (Recommended)

**In Railway Shell:**
```bash
railway shell
npm run ensure-seed
exit
```

This will:
- ✅ Create tables if they don't exist
- ✅ Create all 4 default users (student, teacher, admin, parent)
- ✅ Set correct password hashes
- ✅ Verify everything works

### Option 2: Run Seed Script

**In Railway Shell:**
```bash
railway shell
npm run migrate  # Create tables
npm run seed     # Create users
exit
```

### Option 3: Auto-Seed on Startup (Already Added)

The code now auto-seeds on startup if no users exist. After next deployment:
- Server will check if users exist
- If empty, it will automatically run `ensure-seed`
- Users will be created automatically

## Verify After Seeding

```bash
# Check users exist
railway shell
sqlite3 database/lms.db "SELECT username, role FROM users;"

# Should show:
# student|student
# teacher|teacher
# admin|admin
# parent|parent
```

## Test Login

After seeding:

```bash
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Should return:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "..."
  }
}
```

## Default Credentials

After seeding:
- **Admin**: `admin` / `password`
- **Student**: `student` / `password`
- **Teacher**: `teacher` / `password`
- **Parent**: `parent` / `password`

## Next Deployment

After the code is deployed, the server will:
1. Check if users exist on startup
2. Auto-seed if database is empty
3. Log the seeding process

No manual intervention needed for future deployments!

## Status

- ✅ Auto-seed code added
- ✅ Code pushed to git
- ⏳ Waiting for Railway deployment
- 🧪 After deployment, users will be auto-created
- 🔧 Or run `npm run ensure-seed` manually now
