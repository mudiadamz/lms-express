# 🔧 Fix: Node.js Version Error on Railway

## Problem

Railway is using Node.js v18.20.8, but `better-sqlite3@12.6.2` requires Node.js 20+.

**Error:**
```
npm warn EBADENGINE Unsupported engine
package: 'better-sqlite3@12.6.2'
required: { node: '20.x || 22.x || 23.x || 24.x || 25.x' }
current: { node: 'v18.20.8', npm: '10.8.2' }
```

## Solution

Configure Railway to use Node.js 20+ by adding version specification files.

### ✅ Files Created

1. **`package.json`** - Added `engines` field:
   ```json
   "engines": {
     "node": ">=20.0.0",
     "npm": ">=10.0.0"
   }
   ```

2. **`.nvmrc`** - Specifies Node.js version:
   ```
   20
   ```

3. **`nixpacks.toml`** - Railway/Nixpacks configuration:
   ```toml
   [phases.setup]
   nixPkgs = ["nodejs_20"]
   ```

### How It Works

Railway (using Nixpacks) will:
1. Check `.nvmrc` → Use Node.js 20
2. Check `package.json` engines → Verify Node.js >= 20
3. Check `nixpacks.toml` → Use Node.js 20 from Nix packages

## Deploy

After committing these files:

```bash
git add server/package.json server/.nvmrc server/nixpacks.toml
git commit -m "Fix: Configure Railway to use Node.js 20"
git push
```

Railway will automatically:
- Detect Node.js 20 requirement
- Use Node.js 20 for build and runtime
- Successfully install `better-sqlite3@12.6.2`

## Verify

After deployment, check Railway logs:

```bash
railway logs
```

Look for:
```
Using Node.js version: 20.x.x
```

Or check in Railway Dashboard:
- Deployments → Latest → Build Logs
- Should show Node.js 20.x.x

## Alternative: Manual Node Version in Railway

If files don't work, set manually in Railway Dashboard:

1. Go to Railway Dashboard
2. Select your project
3. Settings → Variables
4. Add: `NODE_VERSION=20`
5. Redeploy

## Troubleshooting

### Still Using Node 18?

1. **Check Railway Settings**:
   - Settings → Variables → Check for `NODE_VERSION`
   - Remove if set to 18

2. **Clear Build Cache**:
   - Settings → General → Clear Build Cache
   - Redeploy

3. **Verify Files Committed**:
   ```bash
   git ls-files | grep -E "(\.nvmrc|nixpacks\.toml)"
   ```

### Build Still Fails?

Check Railway build logs for:
- Node.js version detected
- `better-sqlite3` installation errors

If still failing, try:
```bash
# Downgrade better-sqlite3 (not recommended)
npm install better-sqlite3@11.7.0
```

But Node.js 20 is better long-term solution.

## Status

✅ **Fixed**: Railway configured to use Node.js 20
✅ **Files**: `.nvmrc`, `nixpacks.toml`, `package.json` engines
✅ **Next**: Commit and push, Railway will auto-detect Node 20
