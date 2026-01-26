#!/bin/bash

# Script untuk deploy backend ke Railway
# Usage: ./deploy-railway.sh

set -e

echo "🚀 Deploying LMS Backend to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "⚠️  Not logged in to Railway. Please login..."
    railway login
fi

# Check if project is initialized
if [ ! -d ".railway" ]; then
    echo "📦 Initializing Railway project..."
    railway init
fi

# Build first to check for errors
echo "📦 Building project..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist folder not found"
    exit 1
fi

echo "✅ Build successful!"

# Check environment variables
echo "🔍 Checking environment variables..."
if ! railway variables 2>/dev/null | grep -q "JWT_SECRET"; then
    echo "⚠️  JWT_SECRET not set. Generating..."
    JWT_SECRET=$(openssl rand -hex 32)
    railway variables set JWT_SECRET="$JWT_SECRET"
    echo "✅ JWT_SECRET set"
fi

if ! railway variables 2>/dev/null | grep -q "NODE_ENV"; then
    echo "⚠️  NODE_ENV not set. Setting to production..."
    railway variables set NODE_ENV=production
fi

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Get URL: railway domain"
echo "   2. Database will auto-initialize (migrate runs on start)"
echo "   3. If needed, seed database: railway shell → npm run seed"
echo "   4. Update frontend VITE_API_BASE_URL with Railway URL"
echo "   5. Test API: curl https://your-app.up.railway.app/health"
echo ""
echo "🔍 Check logs: railway logs"
echo "🌐 Get domain: railway domain"
