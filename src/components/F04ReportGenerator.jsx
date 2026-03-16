import { useState } from 'react'
import { supabase } from '../lib/supabase'

const NAV    = '#0d1f3c'
const GOLD   = '#c9a84c'
const BORDER = '#dde1ea'
const SURFACE = '#f7f8fa'
const FIRM   = 'Transworld Investment and Securities Limited'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const PERIOD_TYPES = [
  { key: 'weekly',    label: 'Weekly',    icon: '📅', desc: 'All mandate days in a selected week',     color: '#1e40af', bg: '#f0f4ff', border: '#c7d2fe' },
  { key: 'monthly',   label: 'Monthly',   icon: '📆', desc: 'All mandate days in a calendar month',    color: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'quarterly', label: 'Quarterly', icon: '📊', desc: 'All mandate days in a calendar quarter',  color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
]

// ── Date helpers ──────────────────────────────────────────────────────────────
function getWeekBounds(dateStr) {
  const d   = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  return { start: mon.toISOString().split('T')[0], end: fri.toISOString().split('T')[0] }
}
function getMonthBounds(year, month) {
  return {
    start: `${year}-${String(month).padStart(2,'0')}-01`,
    end:   new Date(year, month, 0).toISOString().split('T')[0],
  }
}
function getQuarterBounds(year, quarter) {
  const qStart = [1,4,7,10][quarter-1]
  const qEnd   = [3,6,9,12][quarter-1]
  return {
    start: `${year}-${String(qStart).padStart(2,'0')}-01`,
    end:   new Date(year, qEnd, 0).toISOString().split('T')[0],
  }
}
function fmtD(d) {
  if (!d) return '—'
  const safe = String(d).length === 10 ? d + 'T12:00:00' : d
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtDShort(d) {
  if (!d) return '—'
  const safe = String(d).length === 10 ? d + 'T12:00:00' : d
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtN(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString()
}

// ── Print CSS ─────────────────────────────────────────────────────────────────
const PRINT_CSS = (reportType, period, now) => `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 9pt; }
  @page {
    size: A4 landscape; margin: 12mm 14mm;
    @top-left   { content: "${FIRM}"; font-family: Arial; font-size: 7pt; color: #6b7280; }
    @top-right  { content: "Form F-04 · ${reportType} · ${period}"; font-family: Arial; font-size: 7pt; color: #6b7280; }
    @bottom-left   { content: "Confidential — Internal Use Only"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: Arial; font-size: 7pt; color: #9ca3af; }
    @bottom-right  { content: "Printed: ${now}"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
  }
  .doc-hdr { border-bottom: 3px solid #0d1f3c; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
  .firm { font-size: 13pt; font-weight: 700; color: #0d1f3c; }
  .sub  { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
  .hdr-right { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.6; }
  .report-title { font-size: 15pt; font-weight: 700; color: #0d1f3c; margin-bottom: 2px; }
  .report-sub   { font-size: 8.5pt; color: #6b7280; margin-bottom: 12px; }
  .stat-row { display: grid; gap: 8px; margin-bottom: 14px; page-break-inside: avoid; }
  .stat-box { border-radius: 5px; padding: 8px 12px; border: 1px solid #e5e7eb; }
  .stat-box .num { font-size: 18pt; font-weight: 700; line-height: 1; }
  .stat-box .lbl { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .section-hdr { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px 5px 0 0; page-break-after: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 7.5pt; }
  th { padding: 5px 6px; background: #0d1f3c; color: #fff; text-align: left; font-weight: 600; font-size: 7pt; }
  td { padding: 4px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #f9fafb; }
  tfoot td { background: #eef2ff; font-weight: 700; font-size: 8pt; padding: 5px 6px; }
  .badge-buy  { background: #e8f5e9; color: #1a7a4a; font-weight: 700; border-radius: 3px; padding: 1px 5px; }
  .badge-sell { background: #fdecea; color: #c0392b; font-weight: 700; border-radius: 3px; padding: 1px 5px; }
  .partial    { background: #fff8e1; }
  .cert-box { margin-top: 14px; border: 1.5px solid #0d1f3c; border-radius: 7px; padding: 12px 16px; page-break-inside: avoid; }
  .cert-title { font-weight: 700; font-size: 10pt; color: #0d1f3c; margin-bottom: 6px; }
  .cert-text  { font-size: 8pt; color: #374151; line-height: 1.65; margin-bottom: 14px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
  .sig-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line  { margin-top: 20px; border-bottom: 1px solid #374151; }
  .sig-sub   { font-size: 7pt; color: #9ca3af; margin-top: 3px; }
  .ftr { margin-top: 10px; border-top: 1px solid #e5e7eb; padding-top: 6px; display: flex; justify-content: space-between; font-size: 7pt; color: #9ca3af; }
  @media print { body { padding: 0; } }
`

// ── Print function ────────────────────────────────────────────────────────────
function printF04Period({ mandates, allLines, periodLabel, periodType, dateRange }) {
  const now      = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const pw       = periodType === 'weekly' ? 'Weekly' : periodType === 'monthly' ? 'Monthly' : 'Quarterly'
  const reportType = pw + ' Client Trade Mandate Report'

  const totalMandates = mandates.length
  const totalLines    = mandates.reduce((a, m) => a + (m.line_count || 0), 0)
  const totalBuy      = allLines.filter(l => l.side === 'BUY').length
  const totalSell     = allLines.filter(l => l.side === 'SELL').length
  const totalPartial  = allLines.filter(l => l.partial_flag).length

  // ── Day-by-day summary ───────────────────────────────────────────────────
  const summaryRows = mandates.map(m => {
    const lines = allLines.filter(l => l.mandate_id === m.id)
    const buys  = lines.filter(l => l.side === 'BUY').length
    const sells = lines.filter(l => l.side === 'SELL').length
    const parts = lines.filter(l => l.partial_flag).length
    return `<tr>
      <td style="font-weight:600">${fmtDShort(m.trade_date)}</td>
      <td style="text-align:center;font-weight:700">${m.line_count || 0}</td>
      <td style="text-align:center;color:#1a7a4a;font-weight:600">${buys}</td>
      <td style="text-align:center;color:#c0392b;font-weight:600">${sells}</td>
      <td style="text-align:center;color:${parts > 0 ? '#b45309' : '#6b7280'};font-weight:${parts > 0 ? 700 : 400}">${parts}</td>
      <td style="font-size:7pt;color:#6b7280">${m.approver_name || '—'}</td>
      <td style="font-size:7pt;color:#9ca3af;max-width:120px">${m.pdf_name || '—'}</td>
    </tr>`
  }).join('') || `<tr><td colspan="7" style="text-align:center;color:#9ca3af;padding:12px;font-style:italic">No mandates in this period</td></tr>`

  const summaryFoot = mandates.length > 0 ? `
    <tfoot><tr>
      <td>TOTAL (${totalMandates} day${totalMandates !== 1 ? 's' : ''})</td>
      <td style="text-align:center">${totalLines}</td>
      <td style="text-align:center;color:#1a7a4a">${totalBuy}</td>
      <td style="text-align:center;color:#c0392b">${totalSell}</td>
      <td style="text-align:center;color:#b45309">${totalPartial}</td>
      <td colspan="2"></td>
    </tr></tfoot>` : ''

  // ── All mandate lines detail ─────────────────────────────────────────────
  const lineRows = allLines.map((l, i) => {
    const isPartial = l.partial_flag
    return `<tr class="${isPartial ? 'partial' : ''}">
      <td style="font-size:7pt;color:#6b7280;font-weight:600">${fmtDShort(l.eff_date || l.mandate_trade_date)}</td>
      <td style="font-family:monospace;font-size:7pt">${l.cscs_no || '—'}</td>
      <td style="font-weight:600;font-size:7.5pt">${l.client_name || '—'}</td>
      <td><span class="${l.side === 'BUY' ? 'badge-buy' : 'badge-sell'}">${l.side || '—'}</span></td>
      <td style="font-weight:700;font-family:monospace">${l.symbol || '—'}</td>
      <td style="text-align:right">${fmtN(l.avail_units)}</td>
      <td style="text-align:right;font-weight:700;color:${isPartial ? '#b45309' : 'inherit'}">${fmtN(l.jobbed_units)}${isPartial ? ' ⚠️' : ''}</td>
      <td style="text-align:right;font-size:7pt">${l.price_limit || 'Market'}</td>
      <td style="font-size:6.5pt;color:#6b7280">${l.entered_by || '—'}</td>
    </tr>`
  }).join('') || `<tr><td colspan="9" style="text-align:center;color:#9ca3af;padding:12px;font-style:italic">No mandate lines in this period</td></tr>`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>F-04 ${pw} Mandate Report — ${periodLabel}</title>
    <style>${PRINT_CSS(reportType, periodLabel, now)}</style>
  </head><body>
  <div>
    <div class="doc-hdr">
      <div><div class="firm">${FIRM}</div><div class="sub">Compliance Operations · Form F-04 · ${pw} Client Trade Mandate &amp; Order Authorisation</div></div>
      <div class="hdr-right">Printed: ${now}<br/>Period: ${periodLabel}</div>
    </div>

    <div class="report-title">${pw} Client Trade Mandate Report</div>
    <div class="report-sub"><strong>${periodLabel}</strong> &nbsp;·&nbsp; ${dateRange} &nbsp;·&nbsp; ${totalMandates} mandate day${totalMandates !== 1 ? 's' : ''}</div>

    <div class="stat-row" style="grid-template-columns:repeat(5,1fr)">
      <div class="stat-box" style="border-left:4px solid #0d1f3c"><div class="num" style="color:#0d1f3c">${totalMandates}</div><div class="lbl">Mandate Days</div></div>
      <div class="stat-box" style="border-left:4px solid #0d1f3c"><div class="num" style="color:#0d1f3c">${totalLines}</div><div class="lbl">Total Lines</div></div>
      <div class="stat-box" style="border-left:4px solid #1a7a4a"><div class="num" style="color:#1a7a4a">${totalBuy}</div><div class="lbl">Buy Orders</div></div>
      <div class="stat-box" style="border-left:4px solid #c0392b"><div class="num" style="color:#c0392b">${totalSell}</div><div class="lbl">Sell Orders</div></div>
      <div class="stat-box" style="border-left:4px solid #b45309"><div class="num" style="color:#b45309">${totalPartial}</div><div class="lbl">Partial Jobs ⚠️</div></div>
    </div>

    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:5px 5px 0 0;padding:7px 10px;display:flex;align-items:center;gap:8px;page-break-after:avoid">
      <span style="font-weight:700;font-size:10pt;color:#1e40af">📅 ${pw} Summary — Mandate Days</span>
      <span style="margin-left:auto;font-size:8.5pt;font-weight:700;color:#1e40af;padding:1px 9px;background:rgba(255,255,255,0.5);border-radius:20px">${totalMandates} session${totalMandates !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #c7d2fe;border-top:none;border-radius:0 0 5px 5px;margin-bottom:12px">
      <table>
        <thead><tr>
          <th>Trade Date</th><th style="text-align:center">Total Lines</th>
          <th style="text-align:center">Buy</th><th style="text-align:center">Sell</th>
          <th style="text-align:center">Partial</th><th>Approved By</th><th>Source File</th>
        </tr></thead>
        <tbody>${summaryRows}</tbody>
        ${summaryFoot}
      </table>
    </div>

    <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:5px 5px 0 0;padding:7px 10px;display:flex;align-items:center;gap:8px;page-break-after:avoid">
      <span style="font-weight:700;font-size:10pt;color:#1e40af">📋 All Mandate Lines — Full Detail</span>
      <span style="margin-left:auto;font-size:8.5pt;font-weight:700;color:#1e40af;padding:1px 9px;background:rgba(255,255,255,0.5);border-radius:20px">${allLines.length} record${allLines.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #c7d2fe;border-top:none;border-radius:0 0 5px 5px;margin-bottom:12px">
      <table>
        <thead><tr>
          <th>Trade Date</th><th>CSCS No</th><th>Client</th><th>Side</th><th>Symbol</th>
          <th style="text-align:right">Avail Units</th><th style="text-align:right">Jobbed Units</th>
          <th style="text-align:right">Price Limit</th><th>Entered By</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </div>

    ${totalPartial > 0 ? `<div style="padding:8px 12px;background:#fff8e1;border-left:3px solid #b45309;border-radius:0 5px 5px 0;margin-bottom:12px;font-size:8pt;color:#374151">
      ⚠️ <strong>${totalPartial} partial job${totalPartial !== 1 ? 's' : ''}</strong> — Jobbed Units less than Available Units. These lines are highlighted in amber above.
    </div>` : ''}

    <div class="cert-box">
      <div class="cert-title">Compliance Certification</div>
      <div class="cert-text">
        I confirm that this ${pw} Client Trade Mandate &amp; Order Authorisation Report covering <strong>${periodLabel}</strong> (${dateRange})
        is accurate and complete. All mandate lines listed represent valid client instructions received and reviewed
        over the ${totalMandates} trading day${totalMandates !== 1 ? 's' : ''} in this period.
        This report has been prepared in accordance with the Firm's Internal Control Framework — Section 5a (Trading Controls)
        and Best Execution Policy v3.0.
      </div>
      <div class="sig-row">
        <div class="sig-field"><div class="sig-label">Prepared By (Operations)</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Chief Operations Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Compliance Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
      </div>
    </div>

    <div class="ftr">
      <div>${FIRM} — F-04 ${pw} Client Trade Mandate Report · ${periodLabel}</div>
      <div>Confidential · Internal Use Only</div>
    </div>
  </div>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 400) }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function F04ReportGenerator() {
  const [selected,  setSelected]  = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  const thisYear  = new Date().getFullYear()
  const thisMonth = new Date().getMonth() + 1
  const thisQ     = Math.ceil(thisMonth / 3)

  const [weekDate,     setWeekDate]     = useState(new Date().toISOString().split('T')[0])
  const [month,        setMonth]        = useState(thisMonth)
  const [monthYear,    setMonthYear]    = useState(thisYear)
  const [quarter,      setQuarter]      = useState(thisQ)
  const [quarterYear,  setQuarterYear]  = useState(thisYear)

  const years = Array.from({ length: 3 }, (_, i) => thisYear - i)

  async function generate() {
    if (!selected) return
    setLoading(true); setError('')

    try {
      let start, end, periodLabel, dateRange

      if (selected === 'weekly') {
        const b = getWeekBounds(weekDate)
        start = b.start; end = b.end
        periodLabel = `Week of ${fmtDShort(start)}`
        dateRange   = `${fmtD(start)} – ${fmtD(end)}`
      } else if (selected === 'monthly') {
        const b = getMonthBounds(monthYear, month)
        start = b.start; end = b.end
        periodLabel = `${MONTHS[month-1]} ${monthYear}`
        dateRange   = `${fmtD(start)} – ${fmtD(end)}`
      } else {
        const b = getQuarterBounds(quarterYear, quarter)
        start = b.start; end = b.end
        periodLabel = `Q${quarter} ${quarterYear}`
        dateRange   = `${fmtD(start)} – ${fmtD(end)}`
      }

      // Pull mandates
      const { data: mandates, error: mErr } = await supabase
        .from('f04_mandates')
        .select('id, trade_date, status, approver_name, approved_at, pdf_name, line_count')
        .gte('trade_date', start)
        .lte('trade_date', end)
        .eq('status', 'approved')
        .order('trade_date', { ascending: true })

      if (mErr) throw mErr
      if (!mandates || mandates.length === 0) {
        setError(`No approved F-04 mandates found for ${periodLabel}.`)
        setLoading(false)
        return
      }

      // Pull all lines for those mandates
      const mandateIds = mandates.map(m => m.id)
      const { data: lines, error: lErr } = await supabase
        .from('f04_mandate_lines')
        .select('*')
        .in('mandate_id', mandateIds)
        .order('eff_date', { ascending: true })

      if (lErr) throw lErr

      // Attach trade_date to each line for display
      const lineMap = {}
      mandates.forEach(m => { lineMap[m.id] = m.trade_date })
      const enrichedLines = (lines || []).map(l => ({
        ...l,
        mandate_trade_date: lineMap[l.mandate_id],
      }))

      printF04Period({
        mandates,
        allLines:    enrichedLines,
        periodLabel,
        periodType:  selected,
        dateRange,
      })

    } catch (err) {
      setError('Failed to generate report: ' + err.message)
    }

    setLoading(false)
  }

  return (
    <div style={{
      background: '#fff', border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: 24, marginTop: 24,
    }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 4 }}>
          Period Reports
        </div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: NAV, marginBottom: 4 }}>
          Generate F-04 Report
        </div>
        <div style={{ fontSize: 12, color: '#5a6a82' }}>
          Pull all approved F-04 mandates for a period and print a consolidated report with full mandate line detail.
        </div>
      </div>

      {/* Period type selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        {PERIOD_TYPES.map(pt => (
          <div key={pt.key} onClick={() => setSelected(pt.key)}
            style={{
              border: `2px solid ${selected === pt.key ? pt.color : BORDER}`,
              background: selected === pt.key ? pt.bg : '#fff',
              borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
            <div style={{ fontSize: 20, marginBottom: 5 }}>{pt.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: selected === pt.key ? pt.color : NAV, marginBottom: 2 }}>{pt.label}</div>
            <div style={{ fontSize: 11, color: '#5a6a82' }}>{pt.desc}</div>
          </div>
        ))}
      </div>

      {/* Date picker */}
      {selected === 'weekly' && (
        <div style={{ background: SURFACE, borderRadius: 8, padding: '12px 16px', marginBottom: 14, border: `1px solid ${BORDER}` }}>
          <label style={labelStyle}>Select any date in the week</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} style={inputStyle} />
            {weekDate && (
              <div style={{ fontSize: 12, color: '#5a6a82' }}>
                → Covers <strong>{fmtD(getWeekBounds(weekDate).start)} – {fmtD(getWeekBounds(weekDate).end)}</strong>
              </div>
            )}
          </div>
        </div>
      )}
      {selected === 'monthly' && (
        <div style={{ background: SURFACE, borderRadius: 8, padding: '12px 16px', marginBottom: 14, border: `1px solid ${BORDER}` }}>
          <label style={labelStyle}>Select month and year</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <select value={month} onChange={e => setMonth(Number(e.target.value))} style={inputStyle}>
              {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
            </select>
            <select value={monthYear} onChange={e => setMonthYear(Number(e.target.value))} style={inputStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}
      {selected === 'quarterly' && (
        <div style={{ background: SURFACE, borderRadius: 8, padding: '12px 16px', marginBottom: 14, border: `1px solid ${BORDER}` }}>
          <label style={labelStyle}>Select quarter and year</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <select value={quarter} onChange={e => setQuarter(Number(e.target.value))} style={inputStyle}>
              {[1,2,3,4].map(q => (
                <option key={q} value={q}>Q{q} — {MONTHS.slice((q-1)*3, q*3).join(', ')}</option>
              ))}
            </select>
            <select value={quarterYear} onChange={e => setQuarterYear(Number(e.target.value))} style={inputStyle}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: '#fdecea', border: '1px solid #c0392b', color: '#c0392b', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <button onClick={generate} disabled={!selected || loading}
        style={{
          background: selected ? GOLD : '#e0e0e0', color: selected ? NAV : '#aaa',
          border: 'none', borderRadius: 8, padding: '11px 28px',
          fontWeight: 700, fontSize: 14, fontFamily: "'IBM Plex Sans', sans-serif",
          cursor: selected ? 'pointer' : 'not-allowed', transition: 'all 0.2s',
        }}>
        {loading ? '⏳ Loading data…'
          : selected ? `🖨 Generate ${PERIOD_TYPES.find(p => p.key === selected)?.label} Report`
          : 'Select a report type above'}
      </button>
    </div>
  )
}

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
  textTransform: 'uppercase', color: NAV, marginBottom: 8,
}
const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: NAV, outline: 'none', background: '#fff',
  fontFamily: "'IBM Plex Sans', sans-serif",
}
