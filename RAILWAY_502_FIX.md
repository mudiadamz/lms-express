# Fix 502 Bad Gateway - Complete Solution

## Problems Identified & Fixed

### 1. ✅ Server Listen Address
**Problem**: Server listening on `localhost` instead of `0.0.0.0`
**Fix**: Changed to `app.listen(PORT, '0.0.0.0', ...)`

### 2. ✅ PORT Type Error
**Problem**: `process.env.PORT` is string, but `listen()` needs number
**Fix**: `const PORT = Number(process.env.PORT) || 3000;`

### 3. ✅ Database Error Handling
**Problem**: Database errors crash server on startup
**Fix**: Added try-catch blocks with proper error logging

### 4. ✅ CORS Too Strict
**Problem**: CORS blocking requests in production
**Fix**: Temporarily allow all origins (can restrict later)

### 5. ✅ Error Handlers
**Problem**: Uncaught errors crash server
**Fix**: Added uncaught exception and unhandled rejection handlers

## Changes Made

### server/src/index.ts
- ✅ PORT converted to number
- ✅ Listen on `0.0.0.0` instead of default
- ✅ Database init wrapped in try-catch
- ✅ CORS more permissive
- ✅ Added error handlers

### server/src/database/db.ts
- ✅ Database connection wrapped in try-catch
- ✅ Better error logging

## Railway-Specific Notes

### Better-sqlite3 Native Module
Railway will automatically compile `better-sqlite3` native module during build. The local error is expected if you used `--ignore-scripts`.

### Database Path
Railway provides persistent storage. Database will be created at:
- `./database/lms.db` (relative to app root)

### Port
Railway automatically sets `PORT` environment variable. Code now correctly handles it.

## Deploy Again

```bash
cd server

# Commit changes
git add .
git commit -m "Fix 502 error: listen on 0.0.0.0, fix PORT type, add error handling"

# Deploy
railway up
```

## Verify Deployment

After deploy, check logs:
```bash
railway logs
```

Look for:
- ✅ "Server is running on port X"
- ✅ "Database initialized successfully" or "Database connected"
- ❌ Any error messages

## Test Endpoints

```bash
# Get Railway URL
RAILWAY_URL=$(railway domain --json | jq -r '.domain')

# Health check
curl $RAILWAY_URL/health

# Should return: {"success":true,"message":"Server is running"}

# Test login
curl -X POST $RAILWAY_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```

## If Still 502

1. **Check Railway Logs**:
   ```bash
   railway logs --tail 100
   ```

2. **Common Issues**:
   - Better-sqlite3 not compiled → Railway should auto-compile
   - Database path wrong → Check logs for path errors
   - Missing dependencies → Check build logs
   - Port conflict → Railway handles this automatically

3. **Rebuild Native Modules** (if needed):
   Railway will do this automatically, but you can force:
   - Delete `.railway` folder
   - Redeploy: `railway up`

## Expected Behavior

After fixes:
1. ✅ Server starts successfully
2. ✅ Database initializes (or shows clear error)
3. ✅ Health endpoint responds
4. ✅ API endpoints work

## Status

All fixes applied! Ready to redeploy.
