#!/bin/bash

# ═══════════════════════════════════════════════════════════════
#  Transworld Compliance — Setup Script
#  Run once from your home directory: bash setup-compliance.sh
# ═══════════════════════════════════════════════════════════════

set -e  # Exit on any error

BLUE='\033[0;34m'
GOLD='\033[0;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No colour

echo ""
echo -e "${GOLD}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GOLD}║   Transworld Compliance — Project Setup       ║${NC}"
echo -e "${GOLD}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Check Node is installed ─────────────────────────────────
echo -e "${BLUE}[1/5] Checking Node.js...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Install it from: https://nodejs.org (download the LTS version)"
  echo "  Then run this script again."
  exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"

# ── 2. Check npm ───────────────────────────────────────────────
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm not found. Please install Node.js from https://nodejs.org${NC}"
  exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm $NPM_VERSION found${NC}"

# ── 3. Find the project folder ─────────────────────────────────
echo ""
echo -e "${BLUE}[2/5] Locating project folder...${NC}"

# Check common locations
if [ -d "$HOME/transworld-compliance" ]; then
  PROJECT_DIR="$HOME/transworld-compliance"
elif [ -d "$HOME/Downloads/transworld-compliance" ]; then
  PROJECT_DIR="$HOME/Downloads/transworld-compliance"
else
  echo -e "${RED}✗ Could not find transworld-compliance folder.${NC}"
  echo "  Make sure you copied the transworld-compliance folder to your"
  echo "  home directory (~/) or Downloads folder."
  echo ""
  echo "  Expected location: $HOME/transworld-compliance"
  exit 1
fi

echo -e "${GREEN}✓ Found project at: $PROJECT_DIR${NC}"
cd "$PROJECT_DIR"

# ── 4. Check .env file ─────────────────────────────────────────
echo ""
echo -e "${BLUE}[3/5] Checking environment configuration...${NC}"

if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${GOLD}⚠  Created .env from template${NC}"
    echo ""
    echo -e "${GOLD}  ┌─────────────────────────────────────────────────────────┐${NC}"
    echo -e "${GOLD}  │  ACTION REQUIRED: Fill in your Supabase credentials     │${NC}"
    echo -e "${GOLD}  │                                                          │${NC}"
    echo -e "${GOLD}  │  1. Go to: https://supabase.com/dashboard               │${NC}"
    echo -e "${GOLD}  │  2. Create a NEW project for Transworld Compliance       │${NC}"
    echo -e "${GOLD}  │     (keep it separate from your existing portal project) │${NC}"
    echo -e "${GOLD}  │  3. Project Settings → API                              │${NC}"
    echo -e "${GOLD}  │  4. Copy Project URL and anon public key                 │${NC}"
    echo -e "${GOLD}  │  5. Open .env in this folder and paste them in           │${NC}"
    echo -e "${GOLD}  └─────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo "  Opening .env for you now..."
    sleep 1
    open -e .env 2>/dev/null || nano .env
    echo ""
    read -p "  Press Enter once you've saved your Supabase credentials... "
  else
    echo -e "${RED}✗ No .env or .env.example found${NC}"
    exit 1
  fi
else
  # Check if it still has placeholder values
  if grep -q "YOUR-PROJECT-ID" .env; then
    echo -e "${GOLD}⚠  .env file has placeholder values — please fill in real Supabase credentials${NC}"
    open -e .env 2>/dev/null || nano .env
    read -p "  Press Enter once you've saved your Supabase credentials... "
  else
    echo -e "${GREEN}✓ .env file found and configured${NC}"
  fi
fi

# ── 5. Install dependencies ────────────────────────────────────
echo ""
echo -e "${BLUE}[4/5] Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── 6. Print database migration instructions ───────────────────
echo ""
echo -e "${BLUE}[5/5] Database setup...${NC}"
echo ""
echo -e "${GOLD}  ┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "${GOLD}  │  Run the database migration in Supabase                 │${NC}"
echo -e "${GOLD}  │                                                          │${NC}"
echo -e "${GOLD}  │  1. Supabase Dashboard → SQL Editor → New query         │${NC}"
echo -e "${GOLD}  │  2. Open migration_f04_mandates.sql (in this folder)    │${NC}"
echo -e "${GOLD}  │  3. Copy all contents and paste → click Run             │${NC}"
echo -e "${GOLD}  │  4. Then: Storage → New bucket → name: compliance-docs  │${NC}"
echo -e "${GOLD}  │     Set to Private (not public)                         │${NC}"
echo -e "${GOLD}  └─────────────────────────────────────────────────────────┘${NC}"
echo ""

# Open the SQL file so it's ready to copy
if [ -f "migration_f04_mandates.sql" ]; then
  echo "  Opening migration file..."
  open migration_f04_mandates.sql 2>/dev/null || true
fi

read -p "  Press Enter once you've run the migration in Supabase... "

# ── Done ───────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Setup complete!                             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Start the app with:"
echo ""
echo -e "  ${GOLD}cd $PROJECT_DIR${NC}"
echo -e "  ${GOLD}npm run dev${NC}"
echo ""
echo -e "  Then open ${BLUE}http://localhost:5173${NC} in your browser"
echo ""
echo -e "  ${GOLD}When you're ready to deploy to Vercel:${NC}"
echo -e "  ${BLUE}npm install -g vercel${NC}"
echo -e "  ${BLUE}vercel${NC}"
echo -e "  (Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
echo -e "   in Vercel Dashboard → Project → Settings → Environment Variables)"
echo ""
