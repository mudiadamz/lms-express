# 🚀 Deploy Backend API

## Quick Deploy ke Railway (Recommended)

### Step 1: Install & Login

```bash
npm install -g @railway/cli
railway login
```

### Step 2: Deploy

```bash
cd server

# Initialize project (first time only)
railway init

# Deploy
railway up
```

### Step 3: Set Environment Variables

```bash
# Generate and set JWT secret
railway variables set JWT_SECRET=$(openssl rand -hex 32)

# Set environment
railway variables set NODE_ENV=production

# Set frontend URL (optional)
railway variables set FRONTEND_URL=https://your-frontend.vercel.app
```

### Step 4: Get URL

```bash
railway domain
```

Copy URL yang diberikan (contoh: `https://lms-backend.up.railway.app`)

### Step 5: Initialize Database

Database akan auto-initialize karena ada di `railway.json`, tapi jika perlu manual:

```bash
railway shell
npm run migrate
npm run seed
exit
```

## ✅ Setelah Deploy

1. **Copy backend URL** dari Railway
2. **Update frontend** di Vercel Dashboard:
   - Settings → Environment Variables
   - Set: `VITE_API_BASE_URL` = `https://your-backend.up.railway.app/api`
3. **Redeploy frontend**

## 🧪 Test API

```bash
# Health check
curl https://your-backend.up.railway.app/health

# Test login
curl -X POST https://your-backend.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## 📚 Dokumentasi Lengkap

- `DEPLOY_API.md` - Panduan lengkap semua platform
- `QUICK_DEPLOY_API.md` - Quick start guide
- `../DEPLOY_RAILWAY.md` - Detail Railway deployment

## 🔧 Troubleshooting

### Database tidak ada
```bash
railway shell
npm run migrate
npm run seed
```

### CORS Error
Pastikan `FRONTEND_URL` sudah di-set di Railway variables.

### Build Failed
```bash
# Test build lokal
npm run build
```
