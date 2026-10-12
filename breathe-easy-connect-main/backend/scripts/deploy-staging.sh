#!/bin/bash
set -e

echo "🚀 Starting SmartNeb Staging Environment Deployment..."

if [ ! -f .env.staging ]; then
  echo "❌ Error: .env.staging file not found. Copy .env.staging.example to .env.staging and set strong credentials."
  exit 1
fi

export $(cat .env.staging | grep -v '^#' | xargs)

echo "📦 1. Generating Prisma Client..."
npx prisma generate

echo "🗄️ 2. Executing Database Schema Migrations (prisma migrate deploy)..."
npx prisma migrate deploy

echo "🐳 3. Building and launching Docker containers..."
docker compose -f docker-compose.staging.yml up -d --build

echo "✅ Staging environment deployed successfully!"
echo "📍 API Target: ${PUBLIC_API_URL}"
