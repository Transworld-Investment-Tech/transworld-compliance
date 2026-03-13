-- ============================================================
-- F-04 MANDATE TABLES
-- Run this in Supabase SQL Editor
-- Migration: f04_mandate_tables
-- ============================================================

-- 1. Mandate header table (one row per jobbing sheet / trading day)
CREATE TABLE IF NOT EXISTS f04_mandates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date        DATE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'approved'
                      CHECK (status IN ('draft', 'approved', 'reconciled')),
  approver_name     TEXT,
  approver_note     TEXT,
  approved_at       TIMESTAMPTZ,
  pdf_name          TEXT,
  pdf_url           TEXT,
  line_count        INTEGER DEFAULT 0,
  created_by        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Mandate lines table (one row per jobbing sheet row)
CREATE TABLE IF NOT EXISTS f04_mandate_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_id       UUID NOT NULL REFERENCES f04_mandates(id) ON DELETE CASCADE,
  cscs_no          TEXT,
  client_name      TEXT,
  side             TEXT CHECK (side IN ('BUY', 'SELL')),
  symbol           TEXT,
  avail_units      INTEGER,
  jobbed_units     INTEGER,
  price_limit      NUMERIC(18,4),
  eff_date         DATE,
  date_limit       DATE,
  entered_by       TEXT,
  modified_by      TEXT,
  account_officer  TEXT,
  exchange         TEXT DEFAULT 'NGX',
  partial_flag     BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_f04_mandates_trade_date
  ON f04_mandates (trade_date);

CREATE INDEX IF NOT EXISTS idx_f04_lines_mandate_id
  ON f04_mandate_lines (mandate_id);

CREATE INDEX IF NOT EXISTS idx_f04_lines_symbol_date
  ON f04_mandate_lines (symbol, eff_date);

CREATE INDEX IF NOT EXISTS idx_f04_lines_cscs_no
  ON f04_mandate_lines (cscs_no);

-- 4. Enable RLS
ALTER TABLE f04_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE f04_mandate_lines ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies — authenticated users only (adjust role as needed)
CREATE POLICY "Authenticated users can read f04_mandates"
  ON f04_mandates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert f04_mandates"
  ON f04_mandates FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update f04_mandates"
  ON f04_mandates FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read f04_mandate_lines"
  ON f04_mandate_lines FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert f04_mandate_lines"
  ON f04_mandate_lines FOR INSERT
  TO authenticated WITH CHECK (true);

-- 6. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f04_mandates_updated_at
  BEFORE UPDATE ON f04_mandates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DONE. Tables created:
--   f04_mandates        — one record per trading day import
--   f04_mandate_lines   — individual mandate rows
-- ============================================================
