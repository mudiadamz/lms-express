#!/bin/bash

# Script untuk seed database di Railway
# Usage: railway shell, lalu jalankan: npm run seed

echo "🌱 Seeding database..."

# Check if we're in Railway
if [ -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "⚠️  Not in Railway environment, but continuing..."
fi

# Run seed
npm run seed

echo "✅ Database seeded!"
