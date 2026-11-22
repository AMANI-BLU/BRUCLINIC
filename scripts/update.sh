#!/usr/bin/env bash
# ==============================================================================
# BruClinic — Automated Update Script for Ubuntu Server
# Borana University Clinic Management System
# ==============================================================================

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo "=========================================================="
echo " Starting BruClinic Automated Update"
echo " Timestamp: $(date)"
echo " Directory: $APP_DIR"
echo "=========================================================="

# 1. Database Safety Backup
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/bruclinic_backup_preupdate_$TIMESTAMP.sql"

echo "--> [1/5] Creating pre-update database backup..."
if docker ps --format '{{.Names}}' | grep -q "bruclinic-db"; then
    docker exec bruclinic-db pg_dump -U postgres bruclinic > "$BACKUP_FILE"
    echo "    Docker DB backed up to: $BACKUP_FILE"
elif command -v pg_dump >/dev/null 2>&1; then
    pg_dump -U postgres -d bruclinic -f "$BACKUP_FILE" || echo "    Native pg_dump skipped or requires auth"
fi

# 2. Pull Latest Code from Master
echo "--> [2/5] Fetching latest application code..."
git fetch origin master
git reset --hard origin/master

# 3. Detect Deployment Mode & Apply Updates
if [ -f "docker-compose.prod.yml" ] && command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "--> [3/5] Updating Docker containers and applying database migrations..."
    docker compose -f docker-compose.prod.yml up -d --build
    
    echo "--> [4/5] Cleaning up old unused Docker images..."
    docker image prune -f
else
    echo "--> [3/5] Updating Native Node/PM2 deployment..."
    # Backend
    cd "$APP_DIR/backend"
    npm ci --omit=dev
    npm run db:migrate
    
    # Frontend
    cd "$APP_DIR/frontend"
    npm ci
    npm run build
    
    cd "$APP_DIR"
    
    echo "--> [4/5] Reloading PM2 and Nginx..."
    if command -v pm2 >/dev/null 2>&1; then
        pm2 reload bruclinic-api || pm2 start backend/src/server.js --name bruclinic-api
    fi
    if command -v systemctl >/dev/null 2>&1; then
        sudo systemctl reload nginx || true
    fi
fi

# 5. Health Check Verification
echo "--> [5/5] Verifying API Health..."
sleep 3
if command -v curl >/dev/null 2>&1; then
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health || curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
    if [ "$HEALTH" = "200" ]; then
        echo "    SUCCESS: BruClinic API is healthy (HTTP 200 OK)."
    else
        echo "    WARNING: API responded with HTTP $HEALTH. Check logs."
    fi
fi

echo "=========================================================="
echo " BruClinic Update Completed Successfully!"
echo "=========================================================="
