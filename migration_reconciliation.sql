-- ============================================================
-- RECONCILIATION TABLES (F-05)
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Session header — one per trading day
CREATE TABLE IF NOT EXISTS reconciliation_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_date            DATE NOT NULL,
  status                TEXT NOT NULL DEFAULT 'approved'
                          CHECK (status IN ('draft','approved')),
  approver_name         TEXT,
  approver_note         TEXT,
  approved_at           TIMESTAMPTZ,
  fully_executed_count  INTEGER DEFAULT 0,
  partial_count         INTEGER DEFAULT 0,
  not_jobbed_count      INTEGER DEFAULT 0,
  created_by            TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Individual trade lines
CREATE TABLE IF NOT EXISTS reconciliation_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID NOT NULL REFERENCES reconciliation_sessions(id) ON DELETE CASCADE,
  section_type      TEXT NOT NULL CHECK (section_type IN ('fully_executed','partial','not_jobbed')),
  effective_date    TEXT,
  client            TEXT,
  cscs_acc_num      TEXT,
  order_type        TEXT,
  security          TEXT,
  units             INTEGER,
  units_jobbed      INTEGER,
  units_traded      INTEGER,
  units_outstanding INTEGER,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_recon_sessions_trade_date
  ON reconciliation_sessions (trade_date);

CREATE INDEX IF NOT EXISTS idx_recon_lines_session_id
  ON reconciliation_lines (session_id);

CREATE INDEX IF NOT EXISTS idx_recon_lines_section_type
  ON reconciliation_lines (section_type);

CREATE INDEX IF NOT EXISTS idx_recon_lines_security
  ON reconciliation_lines (security);

-- 4. RLS
ALTER TABLE reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_lines    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read reconciliation_sessions"
  ON reconciliation_sessions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users insert reconciliation_sessions"
  ON reconciliation_sessions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Auth users update reconciliation_sessions"
  ON reconciliation_sessions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Auth users read reconciliation_lines"
  ON reconciliation_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Auth users insert reconciliation_lines"
  ON reconciliation_lines FOR INSERT TO authenticated WITH CHECK (true);

-- 5. Updated_at trigger
CREATE TRIGGER reconciliation_sessions_updated_at
  BEFORE UPDATE ON reconciliation_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DONE. Tables created:
--   reconciliation_sessions  — one record per trading day
--   reconciliation_lines     — individual trade lines
-- ============================================================
