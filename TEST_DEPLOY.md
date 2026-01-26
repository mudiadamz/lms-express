# ✅ Railway Deploy - Testing & Fixes

## Pre-Deployment Checklist

- [x] ✅ `tsx` dan `typescript` sudah di `dependencies` (bukan devDependencies)
- [x] ✅ Build script menggunakan `npx tsc`
- [x] ✅ `railway.json` sudah dikonfigurasi dengan benar
- [x] ✅ Start command: `npm run migrate && npm start`
- [x] ✅ Build lokal berhasil
- [x] ✅ Dependencies terinstall

## Deploy Commands

```bash
cd server

# 1. Login (jika belum)
railway login

# 2. Initialize (first time)
railway init
# Pilih: Create new project → Name: lms-backend

# 3. Set environment variables
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set NODE_ENV=production

# 4. Deploy
railway up

# 5. Get URL
railway domain
```

## Testing After Deploy

### 1. Health Check

```bash
# Get your Railway URL
RAILWAY_URL="https://your-app.up.railway.app"

# Test health endpoint
curl $RAILWAY_URL/health
```

Expected response:
```json
{"success":true,"message":"Server is running"}
```

### 2. Test Login

```bash
curl -X POST $RAILWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {...},
    "token": "..."
  }
}
```

### 3. Test Other Endpoints

```bash
# Get users (requires auth token)
TOKEN="your-token-from-login"
curl -H "Authorization: Bearer $TOKEN" \
  $RAILWAY_URL/api/users

# Get classes
curl -H "Authorization: Bearer $TOKEN" \
  $RAILWAY_URL/api/classes
```

## Common Issues & Fixes

### Issue 1: Build Failed - tsx not found

**Error:**
```
sh: tsx: command not found
```

**Fix:**
Pastikan `tsx` ada di `dependencies`:
```json
{
  "dependencies": {
    "tsx": "^4.7.0"
  }
}
```

✅ **Already fixed** - tsx sudah di dependencies

### Issue 2: Build Failed - tsc not found

**Error:**
```
tsc: command not found
```

**Fix:**
Pastikan `typescript` ada di `dependencies` dan build script menggunakan `npx`:
```json
{
  "scripts": {
    "build": "npx tsc"
  },
  "dependencies": {
    "typescript": "^5.5.3"
  }
}
```

✅ **Already fixed** - typescript sudah di dependencies, build menggunakan npx

### Issue 3: Database not found

**Error:**
```
SQLITE_ERROR: no such table: users
```

**Fix:**
Database akan auto-initialize karena migrate ada di startCommand. Jika masih error:

```bash
railway shell
npm run migrate
npm run seed
exit
```

### Issue 4: Port Error

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Fix:**
Railway otomatis set PORT. Pastikan kode menggunakan `process.env.PORT`:

✅ **Already correct** - `server/src/index.ts` menggunakan `process.env.PORT || 3000`

### Issue 5: CORS Error

**Error:**
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Fix:**
Set `FRONTEND_URL` di Railway variables:
```bash
railway variables set FRONTEND_URL=https://your-frontend.vercel.app
```

Atau update `allowedOrigins` di `server/src/index.ts` untuk include Railway domain.

### Issue 6: JWT Secret Error

**Error:**
```
jwt malformed
```

**Fix:**
Pastikan `JWT_SECRET` sudah di-set:
```bash
railway variables set JWT_SECRET=$(openssl rand -hex 32)
```

## Monitoring

### View Logs

```bash
# Real-time logs
railway logs

# Or via dashboard
# Railway Dashboard → Deployments → Latest → View Logs
```

### Check Status

```bash
railway status
```

### View Metrics

Railway Dashboard → Metrics (CPU, Memory, Network)

## After Successful Deploy

1. ✅ Copy Railway URL
2. ✅ Update frontend `VITE_API_BASE_URL` di Vercel
3. ✅ Redeploy frontend
4. ✅ Test full application flow

## Quick Test Script

```bash
#!/bin/bash
# test-railway.sh

RAILWAY_URL=$(railway domain --json 2>/dev/null | jq -r '.domain' || echo "https://your-app.up.railway.app")

echo "Testing Railway deployment at: $RAILWAY_URL"
echo ""

echo "1. Health check..."
curl -s $RAILWAY_URL/health | jq .
echo ""

echo "2. Testing login..."
LOGIN_RESPONSE=$(curl -s -X POST $RAILWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}')

echo "$LOGIN_RESPONSE" | jq .

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    echo ""
    echo "✅ Login successful! Token: ${TOKEN:0:20}..."
    
    echo ""
    echo "3. Testing authenticated endpoint..."
    curl -s -H "Authorization: Bearer $TOKEN" \
      $RAILWAY_URL/api/users | jq '.success'
else
    echo "❌ Login failed"
fi
```
