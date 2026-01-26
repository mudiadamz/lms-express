# 🌱 How to Run `npm run seed` on Railway

Panduan lengkap untuk menjalankan seed script di Railway (membuat default users).

## 🎯 Method 1: Via Railway Dashboard (Easiest - Recommended)

### Step-by-Step:

1. **Go to Railway Dashboard**
   - Visit: https://railway.app
   - Login to your account

2. **Select Your Project**
   - Click on your project (e.g., `lms-backend`)

3. **Open Shell Tab**
   - Click on **"Shell"** tab (usually at the top or in the sidebar)
   - This opens a terminal/console in your Railway container

4. **Run Seed Command**
   ```bash
   npm run seed
   ```

5. **Wait for Completion**
   - You'll see output like:
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

6. **Exit Shell**
   - Type `exit` or close the shell tab

### Visual Guide:
```
Railway Dashboard
  └── Your Project (lms-backend)
      └── Shell Tab (click here)
          └── Terminal opens
              └── Type: npm run seed
                  └── ✅ Done!
```

---

## 🖥️ Method 2: Via Railway CLI

### Prerequisites:
- Railway CLI installed: `npm install -g @railway/cli`
- Logged in: `railway login`

### Steps:

1. **Open Terminal** (on your local machine)

2. **Navigate to Server Directory**
   ```bash
   cd server
   ```

3. **Connect to Railway Shell**
   ```bash
   railway shell
   ```
   This will:
   - Connect to your Railway project
   - Open an interactive shell session
   - You'll see a prompt like: `railway@your-project:~$`

4. **Run Seed Command**
   ```bash
   npm run seed
   ```

5. **Wait for Completion**
   - Same output as Method 1

6. **Exit Shell**
   ```bash
   exit
   ```

### Full Example:
```bash
# On your local machine
cd server
railway shell

# Now you're in Railway container
npm run seed

# Exit when done
exit
```

---

## ✅ Verify Seed Worked

After seeding, test the login endpoints:

```bash
# Test student login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'

# Test teacher login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"teacher","password":"password"}'

# Test admin login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Test parent login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"parent","password":"password"}'
```

Each should return a JSON response with `success: true` and user data + token.

---

## 🔄 Reset/Reseed Database

If you need to delete and recreate users:

### Via Railway Dashboard Shell:
```bash
# In Railway Shell tab
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed
```

### Via Railway CLI:
```bash
railway shell
sqlite3 database/lms.db "DELETE FROM users WHERE username IN ('student', 'teacher', 'admin', 'parent');"
npm run seed
exit
```

---

## 🐛 Troubleshooting

### Error: "npm: command not found"
- **Solution**: Make sure you're in the correct directory (`server`)
- The shell should be in the project root where `package.json` exists

### Error: "Database locked" or "SQLITE_BUSY"
- **Solution**: Wait a few seconds and try again
- The database might be in use by the running server

### Error: "Users already exist"
- **Status**: This is OK! The script checks for existing users
- If you want to recreate, delete them first (see Reset section above)

### Seed Script Not Found
- **Check**: Make sure `seed.ts` exists in `server/src/database/`
- **Verify**: Run `ls -la src/database/seed.ts` in Railway shell

### Build Required First
If you get TypeScript errors:
```bash
# In Railway shell
npm run build
npm run seed
```

---

## 📋 What Gets Created

After running `npm run seed`, you'll have:

1. ✅ **Academic Year**: 2024/2025
2. ✅ **4 Default Users**:
   - `student` / `password`
   - `teacher` / `password`
   - `admin` / `password`
   - `parent` / `password`
3. ✅ **1 Class**: X IPA 1
4. ✅ **1 Subject**: Matematika
5. ✅ **Relationships**: Student-Class, Class-Subject, Teacher-Subject

---

## 🎯 Quick Reference

**Dashboard Method:**
```
Dashboard → Project → Shell Tab → npm run seed
```

**CLI Method:**
```bash
railway shell
npm run seed
exit
```

---

## 💡 Tips

1. **First Time**: Always run seed after initial deployment
2. **Re-seeding**: Safe to run multiple times (uses `INSERT OR IGNORE`)
3. **Production**: Change default passwords after seeding
4. **Monitoring**: Check Railway logs if seed fails

---

## 📚 Related Documentation

- `SEED_USERS.md` - Details about default users
- `README_DEPLOY.md` - Full deployment guide
- `DEPLOY_RAILWAY.md` - Railway-specific deployment
