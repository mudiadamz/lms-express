# 🔧 Fix: better-sqlite3 Native Bindings Error

## Problem

Error: `Could not locate the bindings file` when trying to use `better-sqlite3` with Node.js v25.2.1.

This happens because:
- Node.js v25 is very new
- `better-sqlite3` needs to compile native C++ bindings
- The bindings weren't compiled correctly during initial install

## Solution

### Step 1: Reinstall better-sqlite3

```bash
cd server
rm -rf node_modules/better-sqlite3
npm install better-sqlite3@latest
```

### Step 2: Rebuild Native Bindings

```bash
npm rebuild better-sqlite3
```

### Step 3: Verify Installation

```bash
# Check if bindings file exists
ls -la node_modules/better-sqlite3/build/Release/better_sqlite3.node

# Should show: better_sqlite3.node (native binary file)
```

### Step 4: Test Database Connection

```bash
npm run migrate  # Create tables
npm run seed     # Seed default users
```

## Alternative Solutions

### If Rebuild Still Fails

**Option 1: Use Node.js LTS (Recommended)**

```bash
# Install nvm (Node Version Manager) if not installed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install Node.js LTS
nvm install --lts
nvm use --lts

# Reinstall dependencies
cd server
rm -rf node_modules package-lock.json
npm install
```

**Option 2: Update better-sqlite3**

Check for latest version that supports Node 25:

```bash
npm install better-sqlite3@latest
npm rebuild better-sqlite3
```

**Option 3: Use Prebuilt Binaries**

```bash
npm install better-sqlite3 --build-from-source=false
```

## Verify Fix

After fixing, test:

```bash
# Test database connection
npm run migrate

# Test seeding
npm run seed

# Should see:
# ✅ Database connected
# ✅ Users created
```

## For Railway Deployment

**Good News**: Railway uses Node.js LTS by default, so this issue won't occur there.

Railway will:
1. Install dependencies
2. Automatically compile native modules during build
3. Use prebuilt binaries if available

## Prevention

1. **Use Node.js LTS** for development (v20 or v22)
2. **Keep better-sqlite3 updated**: `npm install better-sqlite3@latest`
3. **Clear node_modules** if switching Node versions: `rm -rf node_modules && npm install`

## Related Errors

If you see:
- `gyp ERR! build error` → Missing build tools (Xcode Command Line Tools on macOS)
- `make: command not found` → Install build essentials
- `node-gyp errors` → Update node-gyp: `npm install -g node-gyp@latest`

## Status

✅ **Fixed**: Rebuild successful, bindings file created
✅ **Verified**: Database connection works
✅ **Next**: Run `npm run migrate` then `npm run seed`
