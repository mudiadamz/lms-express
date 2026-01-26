# 🔐 Quick Fix: "Invalid username or password"

## Problem

Getting "Invalid username or password" error when trying to login.

**Cause**: Database hasn't been seeded on Railway yet.

## Solution: Seed Database on Railway

### Method 1: Via Railway Dashboard (Easiest)

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Login and select your project

2. **Open Shell**
   - Click **"Shell"** tab
   - Terminal opens in browser

3. **Run Migration** (if tables don't exist)
   ```bash
   npm run migrate
   ```

4. **Run Seed Script**
   ```bash
   npm run seed
   ```

5. **Verify Users Created**
   ```bash
   sqlite3 database/lms.db "SELECT username, role FROM users;"
   ```
   
   Should show:
   ```
   student|student
   teacher|teacher
   admin|admin
   parent|parent
   ```

6. **Test Login**
   ```bash
   curl -X POST https://your-app.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"student","password":"password"}'
   ```

### Method 2: Via Railway CLI

```bash
# Connect to Railway shell
railway shell

# Run migration
npm run migrate

# Run seed
npm run seed

# Verify
sqlite3 database/lms.db "SELECT username, role FROM users;"

# Exit
exit
```

## Default Credentials

After seeding, use these exact credentials:

| Role | Username | Password |
|------|----------|----------|
| Student | `student` | `password` |
| Teacher | `teacher` | `password` |
| Admin | `admin` | `password` |
| Parent | `parent` | `password` |

⚠️ **Important**: 
- Username is **case-sensitive**: `student` not `Student`
- Password is **case-sensitive**: `password` not `Password`

## Troubleshooting

### Error: "npm: command not found"
```bash
# Make sure you're in the right directory
pwd
# Should show: /app

# If not, navigate there
cd /app
```

### Error: "no such table: users"
```bash
# Run migration first
npm run migrate

# Then seed
npm run seed
```

### Error: "Database locked"
- Wait a few seconds
- The server might be using the database
- Try again

### Seed Runs But Still Can't Login

1. **Check username spelling**: Must be exactly `student`, `teacher`, `admin`, or `parent`
2. **Check password**: Must be exactly `password` (all lowercase)
3. **Verify users exist**:
   ```bash
   sqlite3 database/lms.db "SELECT username, role FROM users WHERE username = 'student';"
   ```
4. **Check password hash** (if you have access):
   ```bash
   sqlite3 database/lms.db "SELECT username, substr(password, 1, 20) as pwd_preview FROM users WHERE username = 'student';"
   ```
   Should show a bcrypt hash starting with `$2a$` or `$2b$`

### Still Getting Error?

1. **Check Railway Logs**:
   ```bash
   railway logs
   ```
   Look for database connection errors

2. **Verify Database Path**:
   ```bash
   railway shell
   echo $DB_PATH
   ls -la database/
   ```

3. **Re-seed Database**:
   ```bash
   railway shell
   sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
   npm run seed
   ```

## Quick Test

Run this in Railway shell to verify everything:

```bash
# Check database exists
ls -la database/

# Check tables exist
sqlite3 database/lms.db ".tables"

# Check users exist
sqlite3 database/lms.db "SELECT username, role FROM users;"

# If empty, seed
npm run migrate
npm run seed

# Verify again
sqlite3 database/lms.db "SELECT username, role FROM users;"
```

## Expected Output After Seed

```
🌱 Seeding database...
✅ Password hash created
✅ Academic year created
✅ Student user created: student / password
✅ Teacher user created: teacher / password
✅ Admin user created: admin / password
✅ Parent user created: parent / password
✅ Class created: X IPA 1
✅ Student assigned to class
✅ Subject created: Matematika
✅ Class-Subject linked
✅ Student-Class linked

✅ Database seeded successfully!

📋 Default Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Student:
   Username: student
   Password: password

👨‍🏫 Teacher:
   Username: teacher
   Password: password

👑 Admin:
   Username: admin
   Password: password

👨‍👩 Parent:
   Username: parent
   Password: password
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## After Seeding

Once seeded, try logging in again with:
- Username: `student`
- Password: `password`

If it still fails, check:
1. Railway logs for errors
2. Database path is correct
3. Server is running and can access database
