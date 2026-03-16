#!/bin/bash
# ═══════════════════════════════════════════════════════
#  Deploy Reconciliation Module (F-05)
#  Run from ~/transworld-compliance: bash deploy-reconciliation.sh
# ═══════════════════════════════════════════════════════

set -e
GOLD='\033[0;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

cd ~/transworld-compliance

echo ""
echo -e "${GOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GOLD}║   Deploying F-05 Reconciliation Module        ║${NC}"
echo -e "${GOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Step 1 — Run the SQL migration
echo -e "${BLUE}[1/3] Database migration...${NC}"
echo ""
echo -e "${GOLD}  ACTION REQUIRED:${NC}"
echo "  1. Go to Supabase Dashboard → SQL Editor → New query"
echo "  2. The migration file will open now — copy all and paste into Supabase"
echo "  3. Click Run → confirm you see 'Success'"
echo ""
open -e ~/transworld-compliance/migration_reconciliation.sql 2>/dev/null || true
read -p "  Press Enter once migration is done in Supabase... "
echo -e "${GREEN}  ✓ Migration confirmed${NC}"

# Step 2 — Install dependencies (xlsx package)
echo ""
echo -e "${BLUE}[2/3] Installing dependencies (xlsx package)...${NC}"
npm install
echo -e "${GREEN}  ✓ Dependencies installed${NC}"

# Step 3 — Commit and deploy
echo ""
echo -e "${BLUE}[3/3] Deploying to Vercel...${NC}"
git add .
git commit -m "feat: add F-05 reconciliation module with Jobbing Book Utilization upload"
git push
vercel --prod

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Reconciliation module is live! ✅            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Open: ${BLUE}https://transworld-compliance.vercel.app/reconcile${NC}"
echo ""
echo -e "${GOLD}  Florence's daily workflow:${NC}"
echo "  1. NaYa → Intelligence → Jobbing Book Utilization"
echo "  2. Enter today's date → Get Report"
echo "  3. Click Excel on each section with data (skip empty ones)"
echo "  4. Drop all files into the portal → Approve & Lock"
echo ""
