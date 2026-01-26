# Quick Fix: Route Not Found

## Problem

Accessing `/auth/login` returns "Route not found"

## Solution

### Option 1: Use Correct Route (Works Now)

The correct route is `/api/auth/login`:

```
POST https://lms-api-production-22e9.up.railway.app/api/auth/login
```

**Test:**
```bash
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

### Option 2: Alias Route (After Redeploy)

I've added alias route `/auth` that maps to `/api/auth`. 

**After redeploy, both will work:**
- `/api/auth/login` ✅
- `/auth/login` ✅

**To enable alias, redeploy:**
```bash
cd server
railway up
```

## Current Status

✅ Server is running (health check works)
✅ `/api/auth/login` route exists and works
❌ `/auth/login` alias not active yet (needs redeploy)

## Test Current Route

```bash
# This works NOW
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## If Login Fails: Seed Database

If you get "Invalid username or password", seed the database:

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

## All Working Routes

- ✅ `GET /health` - Health check
- ✅ `GET /` - Root endpoint
- ✅ `POST /api/auth/login` - Login
- ✅ `POST /api/auth/logout` - Logout
- ✅ All `/api/*` routes

## After Redeploy

After redeploying with the alias route fix:
- ✅ `POST /auth/login` will also work
- ✅ `POST /auth/logout` will also work

## Quick Test

```bash
# Test health (should work)
curl https://lms-api-production-22e9.up.railway.app/health

# Test login with correct route (should work)
curl -X POST https://lms-api-production-22e9.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```
