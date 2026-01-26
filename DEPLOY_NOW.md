# 🚀 Deploy Sekarang ke Railway

## Quick Commands

```bash
cd server

# 1. Login (jika belum)
railway login

# 2. Initialize (first time only)
railway init

# 3. Set environment variables
railway variables set JWT_SECRET=$(openssl rand -hex 32)
railway variables set NODE_ENV=production

# 4. Deploy
railway up

# 5. Get URL
railway domain
```

## Status Check

```bash
# Check login
railway whoami

# Check project
railway status

# Check variables
railway variables

# Check logs
railway logs

# Get URL
railway domain
```

## Test After Deploy

```bash
# Get your Railway URL first
RAILWAY_URL=$(railway domain --json | jq -r '.domain')

# Health check
curl $RAILWAY_URL/health

# Test login
curl -X POST $RAILWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## Fix Common Issues

### Issue: Build fails - tsx not found
**Fix**: Pastikan `tsx` dan `typescript` ada di `dependencies` (sudah diperbaiki)

### Issue: Database not found
**Fix**: 
```bash
railway shell
npm run migrate
npm run seed
exit
```

### Issue: Port error
**Fix**: Railway otomatis set PORT. Pastikan kode menggunakan `process.env.PORT` ✅

### Issue: CORS error
**Fix**: Set `FRONTEND_URL` di Railway variables atau update `allowedOrigins` di code

## Next Steps After Deploy

1. ✅ Copy Railway URL
2. ✅ Update `VITE_API_BASE_URL` di Vercel
3. ✅ Redeploy frontend
4. ✅ Test full application
