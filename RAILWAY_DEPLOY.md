# 🚀 Deploy ke Railway - Step by Step

## Prerequisites

1. Railway CLI terinstall: `npm i -g @railway/cli`
2. Sudah login: `railway login`
3. Dependencies sudah di-update (tsx dan typescript di dependencies)

## Step 1: Login ke Railway

```bash
railway login
```

Ini akan membuka browser untuk autentikasi.

## Step 2: Initialize Project

```bash
cd server
railway init
```

Pilih:
- **Create new project** → Name: `lms-backend`
- Atau **Link to existing project** jika sudah ada

## Step 3: Set Environment Variables

```bash
# Generate JWT secret
openssl rand -hex 32

# Set variables
railway variables set JWT_SECRET=your-generated-secret-key-min-32-chars
railway variables set NODE_ENV=production
railway variables set FRONTEND_URL=https://your-frontend.vercel.app
```

Atau via Railway Dashboard:
- Project → Variables → Add Variable

## Step 4: Deploy

```bash
railway up
```

Railway akan:
1. Detect Node.js project
2. Install dependencies
3. Run build (`npm run build`)
4. Run start command (`npm run migrate && npm start`)

## Step 5: Get URL

```bash
railway domain
```

Atau lihat di Railway Dashboard → Settings → Networking

## Step 6: Test API

```bash
# Health check
curl https://your-app.up.railway.app/health

# Test login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## Step 7: Initialize Database (Jika Perlu)

Database akan auto-initialize karena ada di startCommand, tapi jika perlu manual:

```bash
railway shell
npm run migrate
npm run seed
exit
```

## Troubleshooting

### Build Failed

**Error: tsc not found**
- Pastikan `typescript` ada di `dependencies` (bukan hanya devDependencies)
- Railway akan install semua dependencies termasuk TypeScript

**Error: tsx not found**
- Pastikan `tsx` ada di `dependencies`
- Diperlukan untuk run migrate dan seed

**Fix:**
```bash
# Update package.json - pindahkan tsx dan typescript ke dependencies
# Lalu commit dan push
git add package.json
git commit -m "Move tsx and typescript to dependencies for Railway"
git push
```

### Database Error

**Error: Database tidak ada**
```bash
railway shell
npm run migrate
npm run seed
exit
```

### Port Error

Railway otomatis set `PORT` via environment variable. Pastikan kode menggunakan `process.env.PORT`.

### CORS Error

Update `server/src/index.ts` untuk include Railway domain, atau set `FRONTEND_URL` di Railway variables.

## Auto-Deploy dari Git

1. Railway Dashboard → Settings → Source
2. Connect GitHub repository
3. Set Root Directory: `server`
4. Enable Auto-Deploy

Setiap push ke `main` akan auto-deploy!

## Monitoring

- **Logs**: Railway Dashboard → Deployments → Latest → View Logs
- **Metrics**: Dashboard → Metrics (CPU, Memory, Network)
- **Domain**: Settings → Networking

## Update Frontend

Setelah backend deployed:

1. Copy Railway URL (misalnya: `https://lms-backend.up.railway.app`)
2. Update di Vercel Dashboard:
   - Settings → Environment Variables
   - Set: `VITE_API_BASE_URL` = `https://lms-backend.up.railway.app/api`
3. Redeploy frontend

## Quick Deploy Script

```bash
#!/bin/bash
# deploy-railway.sh

cd server

# Check login
if ! railway whoami &> /dev/null; then
    echo "Please login to Railway first: railway login"
    exit 1
fi

# Set variables if not set
if ! railway variables 2>/dev/null | grep -q "JWT_SECRET"; then
    echo "Setting JWT_SECRET..."
    railway variables set JWT_SECRET=$(openssl rand -hex 32)
fi

if ! railway variables 2>/dev/null | grep -q "NODE_ENV"; then
    echo "Setting NODE_ENV..."
    railway variables set NODE_ENV=production
fi

# Deploy
echo "Deploying to Railway..."
railway up

# Get URL
echo ""
echo "✅ Deployment complete!"
echo "Get URL: railway domain"
```
