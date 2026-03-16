// ── F-05 Print / PDF Report Generator ────────────────────────────────────────
const FIRM = 'Transworld Investment and Securities Limited'

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 10pt; }
  .page { padding: 14mm 16mm; max-width: 210mm; margin: 0 auto; }
  .hdr { border-bottom: 3px solid #0d1f3c; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid; }
  .hdr .firm { font-size: 13pt; font-weight: 700; color: #0d1f3c; }
  .hdr .sub { font-size: 7pt; color: #6b7280; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
  .hdr-right { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.6; }
  .report-title { font-size: 16pt; font-weight: 700; color: #0d1f3c; margin-bottom: 2px; }
  .report-sub { font-size: 8.5pt; color: #6b7280; margin-bottom: 12px; line-height: 1.5; }
  .stat-row { display: grid; gap: 8px; margin-bottom: 14px; page-break-inside: avoid; }
  .stat-box { border-radius: 5px; padding: 8px 12px; border: 1px solid #e5e7eb; }
  .stat-box .num { font-size: 20pt; font-weight: 700; line-height: 1; }
  .stat-box .lbl { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
  .section-block { margin-top: 12px; }
  .section-hdr { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px 5px 0 0; page-break-after: avoid; }
  .section-hdr .icon { font-size: 12pt; }
  .section-hdr .title { font-weight: 700; font-size: 10pt; }
  .section-hdr .count { margin-left: auto; font-size: 8.5pt; font-weight: 700; padding: 1px 9px; border-radius: 20px; background: rgba(255,255,255,0.5); }
  .section-body { border-radius: 0 0 5px 5px; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  th { padding: 5px 7px; background: #0d1f3c; color: #fff; text-align: left; font-weight: 600; font-size: 7pt; letter-spacing: 0.3px; page-break-after: avoid; }
  td { padding: 4px 7px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #f9fafb; }
  tfoot td { background: #eef2ff; font-weight: 700; font-size: 8.5pt; padding: 5px 7px; }
  .no-data { text-align: center; color: #9ca3af; padding: 12px; font-style: italic; font-size: 8pt; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 20px; font-size: 7pt; font-weight: 700; }
  .badge-sell { background: #fdecea; color: #c0392b; }
  .badge-buy  { background: #e8f5e9; color: #1a7a4a; }
  .badge-mix  { background: #e3f0ff; color: #1565c0; }
  .outstanding { color: #b45309; font-weight: 700; }
  .cert-box { margin-top: 16px; border: 1.5px solid #0d1f3c; border-radius: 7px; padding: 12px 16px; page-break-inside: avoid; }
  .cert-title { font-weight: 700; font-size: 10pt; color: #0d1f3c; margin-bottom: 6px; }
  .cert-text { font-size: 8pt; color: #374151; line-height: 1.65; margin-bottom: 16px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; }
  .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
  .sig-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line { margin-top: 20px; border-bottom: 1px solid #9ca3af; }
  .sig-sub { font-size: 7pt; color: #9ca3af; margin-top: 3px; }
  .ftr { margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 7px; display: flex; justify-content: space-between; font-size: 7pt; color: #9ca3af; page-break-inside: avoid; }
  @page { size: A4 portrait; margin: 14mm 16mm; }
  @media print {
    .page { padding: 0; max-width: 100%; }
    tr { page-break-inside: avoid; }
    .cert-box { page-break-inside: avoid; }
    .ftr { page-break-inside: avoid; }
    .stat-row { page-break-inside: avoid; }
    .section-hdr { page-break-after: avoid; }
  }
`

function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank')
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"/><title>' + title + '</title><style>' + PRINT_CSS + '</style></head><body>' + bodyHtml + '</body></html>')
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 400) }
}

function fmtD(d) {
  if (!d) return '—'
  const safe = String(d).includes('T') ? d : d + 'T12:00:00'
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDShort(d) {
  if (!d) return '—'
  const safe = String(d).includes('T') ? d : d + 'T12:00:00'
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtN(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString()
}

function badge(type) {
  if (type === 'SELL') return '<span class="badge badge-sell">SELL</span>'
  if (type === 'BUY')  return '<span class="badge badge-buy">BUY</span>'
  return '<span class="badge badge-mix">' + (type || '—') + '</span>'
}

function sigBlock() {
  return '<div class="sig-row">' +
    '<div class="sig-field"><div class="sig-label">Prepared By (Operations)</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '<div class="sig-field"><div class="sig-label">Head of Trading</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '<div class="sig-field"><div class="sig-label">Compliance Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '</div>'
}

// ── DAILY ─────────────────────────────────────────────────────────────────────
export function printDailyF05(session) {
  if (!session) return
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const fullyExec = (session.lines || []).filter(l => l.section_type === 'fully_executed')
  const partial   = (session.lines || []).filter(l => l.section_type === 'partial')
  const notJobbed = (session.lines || []).filter(l => l.section_type === 'not_jobbed')

  function stdRows(lines) {
    if (!lines.length) return '<tr><td colspan="6" class="no-data">No records</td></tr>'
    return lines.map(l =>
      '<tr><td>' + fmtDShort(l.effective_date) + '</td>' +
      '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
      '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
      '<td>' + badge(l.order_type) + '</td>' +
      '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
      '<td style="text-align:right">' + fmtN(l.units) + '</td></tr>'
    ).join('')
  }

  const partialRows = partial.length
    ? partial.map(l =>
        '<tr><td>' + fmtDShort(l.effective_date) + '</td>' +
        '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
        '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
        '<td>' + badge(l.order_type) + '</td>' +
        '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
        '<td style="text-align:right">' + fmtN(l.units_jobbed) + '</td>' +
        '<td style="text-align:right;color:#1a7a4a;font-weight:600">' + fmtN(l.units_traded) + '</td>' +
        '<td style="text-align:right" class="outstanding">' + fmtN(l.units_outstanding) + ' ⚠</td></tr>'
      ).join('')
    : '<tr><td colspan="8" class="no-data">No partial fills on this date</td></tr>'

  const html =
    '<div class="page">' +
    '<div class="hdr"><div><div class="firm">' + FIRM + '</div><div class="sub">Compliance Operations &nbsp;·&nbsp; Form F-05 &nbsp;·&nbsp; Daily Trade Reconciliation</div></div>' +
    '<div class="hdr-right">Printed: ' + now + '<br/>Trade Date: ' + fmtD(session.trade_date) + '</div></div>' +
    '<div class="report-title">Daily Trade Reconciliation Report</div>' +
    '<div class="report-sub">Trade Date: <strong>' + fmtD(session.trade_date) + '</strong></div>' +
    '<div class="stat-row" style="grid-template-columns:1fr 1fr 1fr">' +
      '<div class="stat-box" style="border-left:4px solid #1a7a4a"><div class="num" style="color:#1a7a4a">' + (session.fully_executed_count || 0) + '</div><div class="lbl">Fully Executed</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #b45309"><div class="num" style="color:#b45309">' + (session.partial_count || 0) + '</div><div class="lbl">Partial Fills</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1565c0"><div class="num" style="color:#1565c0">' + (session.not_jobbed_count || 0) + '</div><div class="lbl">Self-Directed (E-Trade)</div></div>' +
    '</div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#e8f5e9;border:1px solid #a5d6a7"><span class="icon">✅</span><span class="title" style="color:#1a7a4a">Fully Executed Trades From The Jobbing Book</span><span class="count" style="color:#1a7a4a">' + fullyExec.length + ' record' + (fullyExec.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #a5d6a7;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead><tbody>' + stdRows(fullyExec) + '</tbody></table></div></div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082"><span class="icon">⚠️</span><span class="title" style="color:#b45309">Partially Executed Trades</span><span class="count" style="color:#b45309">' + partial.length + ' record' + (partial.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #ffe082;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Jobbed</th><th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th></tr></thead><tbody>' + partialRows + '</tbody></table></div></div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9"><span class="icon">🔵</span><span class="title" style="color:#1565c0">Executed Trades Not Jobbed (E-Trade Portal)</span><span class="count" style="color:#1565c0">' + notJobbed.length + ' record' + (notJobbed.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #90caf9;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead><tbody>' + stdRows(notJobbed) + '</tbody></table></div></div>' +
    '<div class="cert-box"><div class="cert-title">Compliance Certification</div>' +
    '<div class="cert-text">I confirm that this Daily Trade Reconciliation Report for <strong>' + fmtD(session.trade_date) + '</strong> is accurate and complete. All executed trades have been matched against the Jobbing Book. Partial fills and self-directed trades have been reviewed and acknowledged. This report has been prepared in accordance with the Firm\'s Internal Control Framework — Section 5a (Trading Controls) and NGX Rule 12.2.</div>' +
    sigBlock() + '</div>' +
    '<div class="ftr"><div>' + FIRM + ' — F-05 Daily Trade Reconciliation · ' + fmtD(session.trade_date) + '</div><div>Session: ' + session.id + ' · Confidential</div></div>' +
    '</div>'

  openPrintWindow('F-05 Daily Reconciliation — ' + fmtD(session.trade_date), html)
}

// ── PERIOD ────────────────────────────────────────────────────────────────────
export function printPeriodF05({ sessions, allLines, periodLabel, periodType, dateRange }) {
  const now       = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const totalExec = sessions.reduce((a, s) => a + (s.fully_executed_count || 0), 0)
  const totalPart = sessions.reduce((a, s) => a + (s.partial_count || 0), 0)
  const totalEtrd = sessions.reduce((a, s) => a + (s.not_jobbed_count || 0), 0)
  const totalAll  = totalExec + totalPart + totalEtrd
  const days      = sessions.length
  const pw        = periodType === 'weekly' ? 'Weekly' : periodType === 'monthly' ? 'Monthly' : 'Quarterly'

  const summaryRows = sessions.map(s => {
    const tot = (s.fully_executed_count || 0) + (s.partial_count || 0) + (s.not_jobbed_count || 0)
    const icon = (s.partial_count || 0) > 0 ? '⚠️' : (s.not_jobbed_count || 0) > 0 ? '🔵' : '✅'
    return '<tr><td style="font-weight:600">' + fmtDShort(s.trade_date) + '</td>' +
      '<td style="text-align:center;color:#1a7a4a;font-weight:600">' + (s.fully_executed_count || 0) + '</td>' +
      '<td style="text-align:center;color:' + ((s.partial_count || 0) > 0 ? '#b45309' : '#6b7280') + ';font-weight:' + ((s.partial_count || 0) > 0 ? 700 : 400) + '">' + (s.partial_count || 0) + '</td>' +
      '<td style="text-align:center;color:#1565c0">' + (s.not_jobbed_count || 0) + '</td>' +
      '<td style="text-align:center;font-weight:700">' + tot + '</td>' +
      '<td style="text-align:center">' + icon + '</td></tr>'
  }).join('') || '<tr><td colspan="6" class="no-data">No sessions in this period</td></tr>'

  const summaryFoot = sessions.length
    ? '<tfoot><tr><td>TOTAL (' + days + ' day' + (days !== 1 ? 's' : '') + ')</td><td style="text-align:center;color:#1a7a4a">' + totalExec + '</td><td style="text-align:center;color:#b45309">' + totalPart + '</td><td style="text-align:center;color:#1565c0">' + totalEtrd + '</td><td style="text-align:center">' + totalAll + '</td><td></td></tr></tfoot>'
    : ''

  const partialLines = allLines.filter(l => l.section_type === 'partial')
  const partialRows  = partialLines.map(l =>
    '<tr><td>' + fmtDShort(l.effective_date) + '</td>' +
    '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
    '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
    '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
    '<td>' + badge(l.order_type) + '</td>' +
    '<td style="text-align:right">' + fmtN(l.units_jobbed) + '</td>' +
    '<td style="text-align:right;color:#1a7a4a;font-weight:600">' + fmtN(l.units_traded) + '</td>' +
    '<td style="text-align:right" class="outstanding">' + fmtN(l.units_outstanding) + '</td></tr>'
  ).join('') || '<tr><td colspan="8" class="no-data">No partial fills in this period</td></tr>'

  const etLines = allLines.filter(l => l.section_type === 'not_jobbed')
  const etRows  = etLines.map(l =>
    '<tr><td>' + fmtDShort(l.effective_date) + '</td>' +
    '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
    '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
    '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
    '<td>' + badge(l.order_type) + '</td>' +
    '<td style="text-align:right">' + fmtN(l.units) + '</td></tr>'
  ).join('') || '<tr><td colspan="6" class="no-data">No self-directed trades in this period</td></tr>'

  const html =
    '<div class="page">' +
    '<div class="hdr"><div><div class="firm">' + FIRM + '</div><div class="sub">Compliance Operations &nbsp;·&nbsp; Form F-05 &nbsp;·&nbsp; ' + pw + ' Trade Reconciliation</div></div>' +
    '<div class="hdr-right">Printed: ' + now + '<br/>Period: ' + periodLabel + '</div></div>' +
    '<div class="report-title">' + pw + ' Trade Reconciliation Report</div>' +
    '<div class="report-sub"><strong>' + periodLabel + '</strong> &nbsp;·&nbsp; ' + dateRange + ' &nbsp;·&nbsp; ' + days + ' trading day' + (days !== 1 ? 's' : '') + '</div>' +
    '<div class="stat-row" style="grid-template-columns:repeat(4,1fr)">' +
      '<div class="stat-box" style="border-left:4px solid #0d1f3c"><div class="num" style="color:#0d1f3c">' + totalAll + '</div><div class="lbl">Total Trades</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1a7a4a"><div class="num" style="color:#1a7a4a">' + totalExec + '</div><div class="lbl">Fully Executed</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #b45309"><div class="num" style="color:#b45309">' + totalPart + '</div><div class="lbl">Partial Fills</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1565c0"><div class="num" style="color:#1565c0">' + totalEtrd + '</div><div class="lbl">E-Trade (Not Jobbed)</div></div>' +
    '</div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#f0f4ff;border:1px solid #c7d2fe"><span class="icon">📅</span><span class="title" style="color:#1e40af">' + pw + ' Summary — Trading Days</span><span class="count" style="color:#1e40af">' + days + ' session' + (days !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #c7d2fe;border-top:none"><table><thead><tr><th>Trade Date</th><th style="text-align:center">Executed</th><th style="text-align:center">Partial</th><th style="text-align:center">E-Trade</th><th style="text-align:center">Total</th><th style="text-align:center">Status</th></tr></thead><tbody>' + summaryRows + '</tbody>' + summaryFoot + '</table></div></div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082"><span class="icon">⚠️</span><span class="title" style="color:#b45309">Partial Fills — Full Detail</span><span class="count" style="color:#b45309">' + partialLines.length + ' record' + (partialLines.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #ffe082;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Order</th><th style="text-align:right">Jobbed</th><th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th></tr></thead><tbody>' + partialRows + '</tbody></table></div></div>' +
    '<div class="section-block"><div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9"><span class="icon">🔵</span><span class="title" style="color:#1565c0">Self-Directed Trades (E-Trade Portal) — Full Detail</span><span class="count" style="color:#1565c0">' + etLines.length + ' record' + (etLines.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #90caf9;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Order</th><th style="text-align:right">Units</th></tr></thead><tbody>' + etRows + '</tbody></table></div></div>' +
    '<div class="cert-box"><div class="cert-title">Compliance Certification</div>' +
    '<div class="cert-text">I confirm that this ' + pw + ' Trade Reconciliation Report covering <strong>' + periodLabel + '</strong> (' + dateRange + ') is accurate and complete. All ' + days + ' trading day' + (days !== 1 ? 's' : '') + ' in this period have been reconciled against the Jobbing Book. This report is produced in accordance with the Firm\'s Internal Control Framework — Section 5a (Trading Controls) and NGX Rule 12.2.</div>' +
    sigBlock() + '</div>' +
    '<div class="ftr"><div>' + FIRM + ' — F-05 ' + pw + ' Trade Reconciliation · ' + periodLabel + '</div><div>Confidential · Internal Use Only</div></div>' +
    '</div>'

  openPrintWindow('F-05 ' + pw + ' Reconciliation — ' + periodLabel, html)
}
