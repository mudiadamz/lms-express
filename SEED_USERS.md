# Default Users - Seed Script

## Default Users Created

Seed script akan membuat 4 default users dengan password: `password`

### 👤 Student
- **Username**: `student`
- **Password**: `password`
- **Full Name**: Budi Santoso
- **Email**: student@example.com
- **Role**: student
- **School Level**: SMA
- **Student Number**: 2024001

### 👨‍🏫 Teacher
- **Username**: `teacher`
- **Password**: `password`
- **Full Name**: Ibu Siti
- **Email**: teacher@example.com
- **Role**: teacher
- **School Level**: SMA
- **Teacher Number**: 1985001

### 👑 Admin
- **Username**: `admin`
- **Password**: `password`
- **Full Name**: Admin Sekolah
- **Email**: admin@example.com
- **Role**: admin
- **School Level**: SMA
- **Admin Number**: ADM001

### 👨‍👩 Parent
- **Username**: `parent`
- **Password**: `password`
- **Full Name**: Bapak Santoso
- **Email**: parent@example.com
- **Role**: parent
- **Student ID**: Linked to student user

## Run Seed Script

### Local Development

```bash
cd server
npm run seed
```

### Railway Production

**Via Railway Dashboard:**
1. Go to Railway Dashboard
2. Select your project
3. Click "Shell" tab
4. Run: `npm run seed`
5. Exit shell

**Via CLI:**
```bash
railway shell
npm run seed
exit
```

## What Gets Created

1. ✅ Academic Year: 2024/2025
2. ✅ 4 Default Users (student, teacher, admin, parent)
3. ✅ 1 Class: X IPA 1
4. ✅ 1 Subject: Matematika
5. ✅ Links: Student-Class, Class-Subject, Teacher-Subject

## Verify Users

After seeding, test login:

```bash
# Test student login
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Test teacher login
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher","password":"password"}'

# Test admin login
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Test parent login
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"parent","password":"password"}'
```

## Reset Users

To delete and recreate users:

```bash
railway shell
# Delete existing users
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
# Run seed again
npm run seed
exit
```

## Security Note

⚠️ **Important**: These are default credentials for development/testing.

**For production:**
- Change all default passwords
- Use strong passwords
- Consider implementing password reset functionality
