# ✅ Fix: tsc not found - RESOLVED

## Problem
Error: `tsc not found` saat build

## Solution Applied

### 1. Updated package.json
Changed build script to use `npx`:
```json
{
  "scripts": {
    "build": "npx tsc"
  }
}
```

### 2. Updated tsconfig.json
Added Node types and disabled declarations:
```json
{
  "compilerOptions": {
    "types": ["node"],
    "declaration": false
  }
}
```

### 3. Fixed Database Export
Changed export in `db.ts` to avoid TypeScript namespace error:
```typescript
export default db as any;
```

### 4. Fixed Type Logic Error
Fixed comparison logic in `assignments.ts` that was causing TypeScript error.

## Build Now Works

```bash
cd server
npm run build
```

✅ Build successful!

## For Production

Di production (Railway/Render), build akan bekerja karena:
- Platform akan install semua dependencies termasuk TypeScript
- Native modules (better-sqlite3) akan di-compile otomatis
- Build command sudah menggunakan `npx tsc` yang akan bekerja di semua environment

## Quick Reference

- **Build**: `npm run build` (uses `npx tsc`)
- **Dev**: `npm run dev` (uses `tsx watch`)
- **Start**: `npm start` (runs compiled `dist/index.js`)
