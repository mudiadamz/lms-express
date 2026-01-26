# 🔍 Verify Database Seeding on Railway

## Problem: "Invalid username or password"

This error means the database hasn't been seeded yet, or the users don't exist.

## Solution: Run Seed Script

### Step 1: Connect to Railway Shell

**Via Railway Dashboard:**
1. Go to Railway Dashboard
2. Select your project
3. Click **"Shell"** tab
4. Terminal will open

**Via CLI:**
```bash
railway shell
```

### Step 2: Check if Database Exists

```bash
# Check if database file exists
ls -la database/

# Should show: lms.db
```

### Step 3: Check if Tables Exist

```bash
# If sqlite3 is available
sqlite3 database/lms.db "SELECT name FROM sqlite_master WHERE type='table';"

# Should show tables like: users, classes, subjects, etc.
```

### Step 4: Check if Users Exist

```bash
sqlite3 database/lms.db "SELECT username, role FROM users;"

# Should show:
# student|student
# teacher|teacher
# admin|admin
# parent|parent
```

### Step 5: Run Migration (if tables don't exist)

```bash
npm run migrate
```

### Step 6: Run Seed Script

```bash
npm run seed
```

You should see:
```
🌱 Seeding database...
✅ Password hash created
✅ Student user created: student / password
✅ Teacher user created: teacher / password
✅ Admin user created: admin / password
✅ Parent user created: parent / password
...
✅ Database seeded successfully!
```

### Step 7: Verify Users Created

```bash
sqlite3 database/lms.db "SELECT username, role FROM users;"
```

### Step 8: Test Login

```bash
# Test student login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Should return JSON with user data and token
```

## Default Credentials

After seeding, use these credentials:

- **Student**: `student` / `password`
- **Teacher**: `teacher` / `password`
- **Admin**: `admin` / `password`
- **Parent**: `parent` / `password`

## Troubleshooting

### Error: "npm: command not found"
- Make sure you're in the `/app` directory
- Run: `cd /app` or `pwd` to check

### Error: "Database locked"
- Wait a few seconds and try again
- The server might be using the database

### Error: "no such table: users"
- Run: `npm run migrate` first
- Then: `npm run seed`

### Seed Script Runs But Users Don't Exist
- Check seed script output for errors
- Verify database path: `echo $DB_PATH` or check `database/lms.db`
- Try deleting and reseeding:
  ```bash
  sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
  npm run seed
  ```

### Still Getting "Invalid username or password"
1. **Verify username spelling**: Must be exactly `student`, `teacher`, `admin`, or `parent`
2. **Verify password**: Must be exactly `password` (lowercase)
3. **Check database**: Run the SQL queries above to verify users exist
4. **Check password hash**: The password is hashed with bcrypt, so you can't see it directly

## Quick Test Script

Run this in Railway shell to verify everything:

```bash
# Check database
ls -la database/

# Check users
sqlite3 database/lms.db "SELECT username, role, full_name FROM users;"

# If empty, seed
npm run seed

# Verify again
sqlite3 database/lms.db "SELECT username, role FROM users;"
```

## Alternative: Check via API

If you can't access shell, check via API:

```bash
# This should fail if users don't exist
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# If it returns "Invalid username or password", users don't exist
# Run seed script in Railway shell
```
