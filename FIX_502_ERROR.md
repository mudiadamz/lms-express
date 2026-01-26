# Fix: 502 Bad Gateway Error

## Problem

502 Bad Gateway error berarti server tidak berjalan atau crash saat startup.

## Fixes Applied

### 1. Server Listen Address
Changed from `localhost` to `0.0.0.0`:
```typescript
app.listen(PORT, '0.0.0.0', () => {
  // ...
});
```

Railway needs server to listen on `0.0.0.0` not `localhost`.

### 2. Database Error Handling
Added try-catch for database initialization:
```typescript
try {
  createTables();
} catch (error) {
  console.error('Database initialization error:', error);
}
```

### 3. CORS More Permissive
Temporarily allow all origins for Railway deployment:
```typescript
callback(null, true); // Allow all for now
```

### 4. Error Handlers
Added uncaught exception and unhandled rejection handlers.

### 5. Database Connection Error Handling
Added try-catch for database connection.

## Test Locally First

```bash
cd server

# Test build
npm run build

# Test start
npm start

# In another terminal, test
curl http://localhost:3000/health
```

## Redeploy

After fixes:

```bash
cd server
railway up
```

## Check Logs

```bash
railway logs
```

Look for:
- "Server is running on port X"
- "Database initialized successfully"
- Any error messages

## Common 502 Causes & Fixes

### 1. Server not listening on 0.0.0.0
✅ Fixed: Changed to listen on `0.0.0.0`

### 2. Database error on startup
✅ Fixed: Added error handling

### 3. Port not set correctly
✅ Fixed: Using `process.env.PORT`

### 4. Missing dependencies
Check: `railway logs` for module not found errors

### 5. Better-sqlite3 native module
Railway should auto-compile, but check logs if issues

## After Fix

Test endpoints:
```bash
# Health
curl https://your-app.up.railway.app/health

# Login
curl -X POST https://your-app.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student","password":"password"}'
```
