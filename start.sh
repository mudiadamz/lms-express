#!/bin/bash

# Railway start script with error handling
set -e

echo "🚀 Starting LMS Backend..."

# Run migrations (don't fail if tables already exist)
echo "📦 Running database migrations..."
npm run migrate || {
  echo "⚠️  Migration had issues, but continuing..."
}

# Start server
echo "🌐 Starting server..."
npm start
