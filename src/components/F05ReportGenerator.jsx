import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { printPeriodF05 } from '../lib/f05Print'

const NAV    = '#0d1f3c'
const GOLD   = '#c9a84c'
const BORDER = '#dde1ea'
const SURFACE = '#f7f8fa'

const PERIOD_TYPES = [
  {
    key: 'weekly',
    label: 'Weekly',
    icon: '📅',
    desc: 'All trading days in a selected week',
    color: '#1e40af',
    bg: '#f0f4ff',
    border: '#c7d2fe',
  },
  {
    key: 'monthly',
    label: 'Monthly',
    icon: '📆',
    desc: 'All trading days in a calendar month',
    color: '#6d28d9',
    bg: '#f5f3ff',
    border: '#ddd6fe',
  },
  {
    key: 'quarterly',
    label: 'Quarterly',
    icon: '📊',
    desc: 'All trading days in a calendar quarter',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
  },
]

// ── Date helpers ──────────────────────────────────────────────────────────────
function getWeekBounds(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun, 1=Mon...
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  return {
    start: mon.toISOString().split('T')[0],
    end:   fri.toISOString().split('T')[0],
  }
}

function getMonthBounds(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const end = new Date(year, month, 0).toISOString().split('T')[0]
  return { start, end }
}

function getQuarterBounds(year, quarter) {
  const qStart = [1, 4, 7, 10][quarter - 1]
  const qEnd   = [3, 6, 9, 12][quarter - 1]
  const start  = `${year}-${String(qStart).padStart(2, '0')}-01`
  const end    = new Date(year, qEnd, 0).toISOString().split('T')[0]
  return { start, end }
}

function fmtD(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

function fmtDLong(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

// ── Main component ────────────────────────────────────────────────────────────
export default function F05ReportGenerator() {
  const [selected, setSelected] = useState(null) // 'weekly' | 'monthly' | 'quarterly'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  // Weekly
  const [weekDate, setWeekDate] = useState(new Date().toISOString().split('T')[0])

  // Monthly
  const thisYear  = new Date().getFullYear()
  const thisMonth = new Date().getMonth() + 1
  const [month, setMonth] = useState(thisMonth)
  const [monthYear, setMonthYear] = useState(thisYear)

  // Quarterly
  const thisQ = Math.ceil(thisMonth / 3)
  const [quarter, setQuarter] = useState(thisQ)
  const [quarterYear, setQuarterYear] = useState(thisYear)

  // ── Fetch and print ─────────────────────────────────────────────────────────
  async function generate() {
    if (!selected) return
    setLoading(true)
    setError('')

    try {
      let start, end, periodLabel, dateRange

      if (selected === 'weekly') {
        const bounds = getWeekBounds(weekDate)
        start = bounds.start
        end   = bounds.end
        periodLabel = `Week of ${fmtD(start)}`
        dateRange   = `${fmtDLong(start)} – ${fmtDLong(end)}`
      } else if (selected === 'monthly') {
        const bounds = getMonthBounds(monthYear, month)
        start = bounds.start
        end   = bounds.end
        periodLabel = `${MONTHS[month - 1]} ${monthYear}`
        dateRange   = `${fmtDLong(start)} – ${fmtDLong(end)}`
      } else {
        const bounds = getQuarterBounds(quarterYear, quarter)
        start = bounds.start
        end   = bounds.end
        periodLabel = `Q${quarter} ${quarterYear}`
        dateRange   = `${fmtDLong(start)} – ${fmtDLong(end)}`
      }

      // Pull sessions
      const { data: sessions, error: sErr } = await supabase
        .from('reconciliation_sessions')
        .select('*')
        .gte('trade_date', start)
        .lte('trade_date', end)
        .eq('status', 'approved')
        .order('trade_date', { ascending: true })

      if (sErr) throw sErr

      if (!sessions || sessions.length === 0) {
        setError(`No approved reconciliation records found for ${periodLabel}.`)
        setLoading(false)
        return
      }

      // Pull all lines for those sessions
      const sessionIds = sessions.map(s => s.id)
      const { data: lines, error: lErr } = await supabase
        .from('reconciliation_lines')
        .select('*')
        .in('session_id', sessionIds)
        .order('effective_date', { ascending: true })

      if (lErr) throw lErr

      printPeriodF05({
        sessions,
        allLines:    lines || [],
        periodLabel,
        periodType:  selected,
        dateRange,
        preparedBy:  'Operations',
      })

    } catch (err) {
      setError('Failed to generate report: ' + err.message)
    }

    setLoading(false)
  }

  const years = Array.from({ length: 3 }, (_, i) => thisYear - i)

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 24,
      marginTop: 24,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 2,
          textTransform: 'uppercase', color: GOLD, marginBottom: 4,
        }}>
          Period Reports
        </div>
        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 17, fontWeight: 700, color: NAV, marginBottom: 4,
        }}>
          Generate F-05 Report
        </div>
        <div style={{ fontSize: 12, color: '#5a6a82' }}>
          Pull all approved reconciliation records for a period and generate a signed PDF report.
        </div>
      </div>

      {/* Period type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {PERIOD_TYPES.map(pt => (
          <div
            key={pt.key}
            onClick={() => setSelected(pt.key)}
            style={{
              border: `2px solid ${selected === pt.key ? pt.color : BORDER}`,
              background: selected === pt.key ? pt.bg : '#fff',
              borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{pt.icon}</div>
            <div style={{
              fontWeight: 700, fontSize: 14, color: selected === pt.key ? pt.color : NAV,
              marginBottom: 3,
            }}>
              {pt.label}
            </div>
            <div style={{ fontSize: 11, color: '#5a6a82' }}>{pt.desc}</div>
          </div>
        ))}
      </div>

      {/* Date pickers */}
      {selected === 'weekly' && (
        <div style={{
          background: SURFACE, borderRadius: 8, padding: '14px 18px', marginBottom: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <label style={labelStyle}>
            Select any date in the week
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="date"
              value={weekDate}
              onChange={e => setWeekDate(e.target.value)}
              style={inputStyle}
            />
            {weekDate && (
              <div style={{ fontSize: 12, color: '#5a6a82' }}>
                → Report will cover{' '}
                <strong>
                  {fmtDLong(getWeekBounds(weekDate).start)} – {fmtDLong(getWeekBounds(weekDate).end)}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {selected === 'monthly' && (
        <div style={{
          background: SURFACE, borderRadius: 8, padding: '14px 18px', marginBottom: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <label style={labelStyle}>Select month and year</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={inputStyle}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select value={monthYear} onChange={e => setMonthYear(Number(e.target.value))} style={inputStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {selected === 'quarterly' && (
        <div style={{
          background: SURFACE, borderRadius: 8, padding: '14px 18px', marginBottom: 16,
          border: `1px solid ${BORDER}`,
        }}>
          <label style={labelStyle}>Select quarter and year</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={inputStyle}>
              {[1, 2, 3, 4].map(q => (
                <option key={q} value={q}>Q{q} — {MONTHS.slice((q-1)*3, q*3).join(', ')}</option>
              ))}
            </select>
            <select value={quarterYear} onChange={e => setQuarterYear(Number(e.target.value))} style={inputStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          background: '#fdecea', border: '1px solid #c0392b',
          color: '#c0392b', borderRadius: 8, padding: '10px 14px',
          fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={generate}
        disabled={!selected || loading}
        style={{
          background: selected ? GOLD : '#e0e0e0',
          color: selected ? NAV : '#aaa',
          border: 'none', borderRadius: 8,
          padding: '11px 28px', fontWeight: 700, fontSize: 14,
          fontFamily: "'IBM Plex Sans', sans-serif",
          cursor: selected ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s',
        }}
      >
        {loading
          ? '⏳ Loading data…'
          : selected
            ? `🖨 Generate ${PERIOD_TYPES.find(p => p.key === selected)?.label} Report`
            : 'Select a report type above'}
      </button>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: NAV, marginBottom: 8,
}

const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 6,
  padding: '7px 10px', fontSize: 13, color: NAV,
  outline: 'none', background: '#fff',
  fontFamily: "'IBM Plex Sans', sans-serif",
}
