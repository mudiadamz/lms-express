# Fix: tsc not found Error

## Problem

Error saat build: `tsc not found`

## Penyebab

1. TypeScript tidak terinstall di `node_modules`
2. Dependencies belum di-install
3. `tsc` tidak ada di PATH

## Solusi

### Opsi 1: Gunakan npx (Recommended)

Update `package.json` untuk menggunakan `npx`:

```json
{
  "scripts": {
    "build": "npx tsc"
  }
}
```

`npx` akan otomatis menggunakan TypeScript dari `node_modules` atau install jika tidak ada.

### Opsi 2: Install Dependencies

```bash
cd server

# Install semua dependencies (termasuk devDependencies)
npm install

# Atau install TypeScript secara eksplisit
npm install --save-dev typescript
```

### Opsi 3: Install TypeScript Global (Tidak Recommended)

```bash
npm install -g typescript
```

**Note:** Tidak recommended karena bisa menyebabkan version conflicts.

## Fix yang Sudah Diterapkan

1. ✅ Update `package.json` build script untuk menggunakan `npx tsc`
2. ✅ Update `tsconfig.json` untuk include Node types
3. ✅ Install dependencies dengan `--ignore-scripts` untuk skip native builds

## Build Sekarang

```bash
cd server
npm run build
```

## Troubleshooting

### Masih Error "tsc not found"

```bash
# Check apakah TypeScript terinstall
npm list typescript

# Install jika tidak ada
npm install --save-dev typescript

# Atau gunakan npx
npx tsc --version
```

### Build Error karena Missing Types

```bash
# Install @types/node
npm install --save-dev @types/node
```

### Better-sqlite3 Build Error

Ini adalah masalah dengan native module compilation. Untuk development, bisa skip:

```bash
# Install tanpa build native modules
npm install --ignore-scripts

# Native modules akan di-build saat runtime atau di production
```

Di production (Railway/Render), platform akan otomatis build native modules.

## Production Build

Di production platform (Railway/Render), build akan bekerja karena:
1. Platform menggunakan build tools yang lengkap
2. Native modules akan di-compile otomatis
3. TypeScript akan di-install sebagai part of build process

## Quick Fix

```bash
cd server

# Install dependencies (skip native builds untuk sekarang)
npm install --ignore-scripts

# Build dengan npx
npx tsc

# Atau via npm script
npm run build
```
