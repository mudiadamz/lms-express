# Default Users - Ready to Use

## Default Credentials

Semua users sudah dibuat dengan password: `password`

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

## Seed Database

### Local Development

```bash
cd server
npm run seed
```

### Railway Production

```bash
railway shell
npm run seed
exit
```

Or via Railway Dashboard:
1. Go to Railway Dashboard
2. Select project
3. Click "Shell" tab
4. Run: `npm run seed`
5. Exit

## Verify Users

After seeding, verify users exist:

```bash
# Login test
curl -X POST https://your-api.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Should return user data and token
```

## Reset Users

To reset/recreate users:

```bash
# Delete existing users
railway shell
# In shell:
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed
exit
```

## Security Note

⚠️ **Important**: Change default passwords in production!

These are default credentials for development/testing only.
