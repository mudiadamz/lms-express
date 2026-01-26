# 🔧 Fix: Dockerfile Node.js Version

## Problem

Railway is using Dockerfile with `node:18-alpine`, but `better-sqlite3@12.6.2` requires Node.js 20+.

**Error:**
```
FROM docker.io/library/node:18-alpine
npm warn EBADENGINE Unsupported engine
package: 'better-sqlite3@12.6.2'
required: { node: '20.x || 22.x || 23.x || 24.x || 25.x' }
current: { node: 'v18.20.8' }
```

Also missing Python/build tools for native compilation:
```
gyp ERR! find Python Python is not set
gyp ERR! find Python You need to install the latest version of Python.
```

## Solution

Updated Dockerfile to:
1. Use Node.js 20 instead of 18
2. Install Python and build tools for `better-sqlite3` native compilation

### Changes Made

**Before:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
```

**After:**
```dockerfile
FROM node:20-alpine

# Install build dependencies for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app
```

## Why This Fixes It

1. **Node.js 20**: Matches `better-sqlite3@12.6.2` requirement
2. **Python3**: Required by `node-gyp` to compile native modules
3. **make & g++**: Required for C++ compilation of `better-sqlite3`

## Deploy

After updating Dockerfile:

```bash
git add server/Dockerfile
git commit -m "Fix: Update Dockerfile to Node.js 20 with build tools"
git push
```

Railway will:
- Rebuild using Node.js 20
- Install Python and build tools
- Successfully compile `better-sqlite3` native bindings
- Complete deployment

## Verify

After deployment, check Railway logs:

```bash
railway logs
```

Look for:
```
FROM node:20-alpine
...
npm ci (should succeed)
...
better-sqlite3 compiled successfully
```

## Alternative: Use Nixpacks Instead

If you prefer not to use Dockerfile, Railway can use Nixpacks:

1. **Delete or rename Dockerfile**:
   ```bash
   mv Dockerfile Dockerfile.backup
   ```

2. **Railway will use Nixpacks** with:
   - `.nvmrc` (Node.js 20)
   - `nixpacks.toml` (Node.js 20 configuration)
   - `package.json` engines field

3. **Redeploy**

## Status

✅ **Fixed**: Dockerfile updated to Node.js 20
✅ **Build Tools**: Python3, make, g++ added
✅ **Next**: Commit and push, Railway will rebuild with Node 20
