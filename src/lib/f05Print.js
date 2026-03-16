// ── F-05 Print / PDF Report Generator ────────────────────────────────────────
const FIRM = 'Transworld Investment and Securities Limited'

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 10pt; }

  /* ── Running header & footer on every printed page ── */
  @page {
    size: A4 portrait;
    margin: 28mm 16mm 22mm 16mm;
    @top-left   { content: "Transworld Investment and Securities Limited"; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #6b7280; }
    @top-right  { content: "F-05 · " attr(data-report-type) " · " attr(data-period); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #6b7280; }
    @bottom-left  { content: "Confidential — Internal Use Only"; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #9ca3af; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #9ca3af; }
    @bottom-right { content: "Printed: " attr(data-printed); font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; color: #9ca3af; }
  }

  /* Screen wrapper */
  .page { padding: 14mm 16mm; max-width: 210mm; margin: 0 auto; }

  /* ── First-page header block (screen only; on print replaced by @page margin) ── */
  .doc-hdr {
    border-bottom: 3px solid #0d1f3c; padding-bottom: 10px; margin-bottom: 14px;
    display: flex; justify-content: space-between; align-items: flex-end;
    page-break-inside: avoid;
  }
  .doc-hdr .firm { font-size: 13pt; font-weight: 700; color: #0d1f3c; }
  .doc-hdr .sub  { font-size: 7pt; color: #6b7280; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
  .doc-hdr-right { text-align: right; font-size: 8pt; color: #6b7280; line-height: 1.6; }

  /* ── Repeated mini-header printed at top of each continuation page ── */
  .page-hdr-repeat {
    display: none;
  }
  @media print {
    .page-hdr-repeat {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 1.5px solid #0d1f3c; padding-bottom: 5px; margin-bottom: 10px;
      page-break-after: avoid;
    }
    .page-hdr-repeat .firm-sm { font-size: 8pt; font-weight: 700; color: #0d1f3c; }
    .page-hdr-repeat .meta-sm { font-size: 7pt; color: #6b7280; text-align: right; }
  }

  .report-title { font-size: 16pt; font-weight: 700; color: #0d1f3c; margin-bottom: 2px; }
  .report-sub   { font-size: 8.5pt; color: #6b7280; margin-bottom: 12px; line-height: 1.5; }

  .stat-row { display: grid; gap: 8px; margin-bottom: 14px; page-break-inside: avoid; }
  .stat-box { border-radius: 5px; padding: 8px 12px; border: 1px solid #e5e7eb; }
  .stat-box .num { font-size: 20pt; font-weight: 700; line-height: 1; }
  .stat-box .lbl { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

  .section-block { margin-top: 12px; }
  .section-hdr { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px 5px 0 0; page-break-after: avoid; }
  .section-hdr .icon  { font-size: 12pt; }
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

  .badge      { display: inline-block; padding: 1px 6px; border-radius: 20px; font-size: 7pt; font-weight: 700; }
  .badge-sell { background: #fdecea; color: #c0392b; }
  .badge-buy  { background: #e8f5e9; color: #1a7a4a; }
  .badge-mix  { background: #e3f0ff; color: #1565c0; }
  .outstanding { color: #b45309; font-weight: 700; }

  /* ── Initials strip — appears at bottom of every non-final page ── */
  .initials-strip {
    display: none;
  }
  @media print {
    .initials-strip {
      display: flex; gap: 32px; align-items: flex-end;
      border-top: 1px dashed #d1d5db; padding-top: 6px; margin-top: 14px;
      page-break-inside: avoid;
    }
    .initials-box { flex: 1; }
    .initials-line { border-bottom: 1px solid #374151; height: 18px; }
    .initials-lbl  { font-size: 6.5pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .initials-note { font-size: 6.5pt; color: #6b7280; margin-left: auto; align-self: flex-end; font-style: italic; }
  }

  /* ── Certification block ── */
  .cert-box { margin-top: 16px; border: 1.5px solid #0d1f3c; border-radius: 7px; padding: 12px 16px; page-break-inside: avoid; }
  .cert-title { font-weight: 700; font-size: 10pt; color: #0d1f3c; margin-bottom: 6px; }
  .cert-text  { font-size: 8pt; color: #374151; line-height: 1.65; margin-bottom: 14px; }

  /* ── Signature block ── */
  .sig-row   { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 6px; }
  .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
  .sig-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-line  { margin-top: 22px; border-bottom: 1px solid #374151; }
  .sig-sub   { font-size: 7pt; color: #9ca3af; margin-top: 3px; }

  /* ── Screen footer ── */
  .doc-ftr {
    margin-top: 12px; border-top: 1px solid #e5e7eb; padding-top: 7px;
    display: flex; justify-content: space-between;
    font-size: 7pt; color: #9ca3af;
  }
  @media print {
    .page { padding: 0; max-width: 100%; }
    .doc-hdr { display: none; } /* replaced by @page top margin on print */
    .doc-ftr { display: none; } /* replaced by @page bottom margin on print */
    tr { page-break-inside: avoid; }
    .cert-box  { page-break-inside: avoid; }
    .stat-row  { page-break-inside: avoid; }
    .section-hdr { page-break-after: avoid; }
  }
`

// ── openPrintWindow ───────────────────────────────────────────────────────────
function openPrintWindow(title, reportType, period, printedDate, bodyHtml) {
  const w = window.open('', '_blank')
  w.document.write(
    '<!DOCTYPE html><html data-report-type="' + reportType + '" data-period="' + period + '" data-printed="' + printedDate + '">' +
    '<head><meta charset="utf-8"/><title>' + title + '</title><style>' + PRINT_CSS + '</style></head>' +
    '<body>' + bodyHtml + '</body></html>'
  )
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 400) }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function fmtD(d) {
  if (!d) return '—'
  const s = String(d)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return new Date(yyyy + '-' + mm + '-' + dd + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  const safe = s.includes('T') ? s : s + 'T12:00:00'
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtDShort(d) {
  if (!d) return '—'
  const s = String(d)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return new Date(yyyy + '-' + mm + '-' + dd + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const safe = s.includes('T') ? s : s + 'T12:00:00'
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

// ── Signature block — final page only ────────────────────────────────────────
function sigBlock() {
  return '<div class="sig-row">' +
    '<div class="sig-field"><div class="sig-label">Prepared By (Operations)</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '<div class="sig-field"><div class="sig-label">Chief Operations Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '<div class="sig-field"><div class="sig-label">Compliance Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>' +
    '</div>'
}

// ── Initials strip — appears between sections on earlier pages ────────────────
function initialsStrip(pageLabel) {
  return '<div class="initials-strip">' +
    '<div class="initials-box"><div class="initials-line"></div><div class="initials-lbl">Operations — Initials</div></div>' +
    '<div class="initials-box"><div class="initials-line"></div><div class="initials-lbl">Chief Operations Officer — Initials</div></div>' +
    '<div class="initials-box"><div class="initials-line"></div><div class="initials-lbl">Compliance Officer — Initials</div></div>' +
    '<div class="initials-note">' + (pageLabel || 'Page ___') + ' — continued overleaf</div>' +
    '</div>'
}

// ── Mini header for continuation pages ───────────────────────────────────────
function pageRepeatHdr(firm, reportType, period) {
  return '<div class="page-hdr-repeat">' +
    '<div><div class="firm-sm">' + firm + '</div></div>' +
    '<div class="meta-sm">' + reportType + ' &nbsp;·&nbsp; ' + period + '</div>' +
    '</div>'
}

// ── DAILY ─────────────────────────────────────────────────────────────────────
export function printDailyF05(session) {
  if (!session) return
  const now        = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const reportType = 'Form F-05 · Daily Trade Reconciliation'
  const period     = fmtD(session.trade_date)
  const fullyExec  = (session.lines || []).filter(l => l.section_type === 'fully_executed')
  const partial    = (session.lines || []).filter(l => l.section_type === 'partial')
  const notJobbed  = (session.lines || []).filter(l => l.section_type === 'not_jobbed')
  const unexecuted = (session.lines || []).filter(l => l.section_type === 'unexecuted')

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

  const unexRows = unexecuted.map(l =>
    '<tr><td style="font-weight:700;color:#c0392b">' + (l.ref_no || '—') + '</td>' +
    '<td>' + fmtDShort(l.effective_date) + '</td>' +
    '<td style="color:#b45309">' + fmtDShort(l.expiry_date) + '</td>' +
    '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
    '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
    '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
    '<td>' + badge(l.order_type) + '</td>' +
    '<td style="text-align:right;font-weight:700;color:#c0392b">' + fmtN(l.units) + '</td>' +
    '<td style="font-size:7.5pt;color:#6b7280">' + (l.entered_by || '—') + '</td>' +
    '<td style="font-size:7.5pt;color:#6b7280">' + (l.approved_by || '—') + '</td></tr>'
  ).join('') || '<tr><td colspan="10" class="no-data">No unexecuted mandates on this date</td></tr>'

  const exceptionsBlock = (partial.length > 0 || unexecuted.length > 0)
    ? '<div style="margin:10px 0;padding:10px 14px;background:#fffbeb;border-left:3px solid #b45309;border-radius:0 5px 5px 0">' +
      '<div style="font-size:7.5pt;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Exceptions Noted This Day</div>' +
      (partial.length > 0 ? '<div style="font-size:8.5pt;color:#374151;margin-bottom:3px">⚠️ <strong>' + partial.length + ' partial fill(s)</strong> — outstanding units require follow-up on next trading day.</div>' : '') +
      (unexecuted.length > 0 ? '<div style="font-size:8.5pt;color:#374151">🔴 <strong>' + unexecuted.length + ' unexecuted mandate(s)</strong> — client instructions were jobbed and approved but not traded on NGX. See table above for details.</div>' : '') +
      '</div>'
    : ''

  const noteBlock = session.approver_note
    ? '<div style="margin:10px 0;padding:10px 14px;background:#f0f4ff;border-left:3px solid #1e40af;border-radius:0 5px 5px 0">' +
      '<div style="font-size:7.5pt;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Head of Operations\' Explanation</div>' +
      '<div style="font-size:9pt;color:#1a1a2e;line-height:1.7;font-style:italic">&ldquo;' + session.approver_note + '&rdquo;</div>' +
      '<div style="font-size:7.5pt;color:#6b7280;margin-top:5px">— ' + (session.approver_name || 'Operations') + ' &nbsp;·&nbsp; ' + (session.approved_at ? new Date(session.approved_at).toLocaleString('en-GB') : '') + '</div>' +
      '</div>'
    : ''

  const html =
    '<div class="page">' +

    // ── First page header ──
    '<div class="doc-hdr">' +
    '<div><div class="firm">' + FIRM + '</div><div class="sub">Compliance Operations &nbsp;·&nbsp; ' + reportType + '</div></div>' +
    '<div class="doc-hdr-right">Printed: ' + now + '<br/>Trade Date: ' + period + '</div>' +
    '</div>' +

    '<div class="report-title">Daily Trade Reconciliation Report</div>' +
    '<div class="report-sub">Trade Date: <strong>' + period + '</strong></div>' +

    '<div class="stat-row" style="grid-template-columns:' + (unexecuted.length > 0 ? 'repeat(4,1fr)' : '1fr 1fr 1fr') + '">' +
      '<div class="stat-box" style="border-left:4px solid #1a7a4a"><div class="num" style="color:#1a7a4a">' + (session.fully_executed_count || 0) + '</div><div class="lbl">Fully Executed</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #b45309"><div class="num" style="color:#b45309">' + (session.partial_count || 0) + '</div><div class="lbl">Partial Fills</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1565c0"><div class="num" style="color:#1565c0">' + (session.not_jobbed_count || 0) + '</div><div class="lbl">Self-Directed (E-Trade)</div></div>' +
      (unexecuted.length > 0 ? '<div class="stat-box" style="border-left:4px solid #c0392b"><div class="num" style="color:#c0392b">' + unexecuted.length + '</div><div class="lbl">Unexecuted Mandates</div></div>' : '') +
    '</div>' +

    // Initials strip after stats (before tables)
    initialsStrip('Page 1') +

    // ── Sections ──
    pageRepeatHdr(FIRM, reportType, period) +
    '<div class="section-block"><div class="section-hdr" style="background:#e8f5e9;border:1px solid #a5d6a7"><span class="icon">✅</span><span class="title" style="color:#1a7a4a">Fully Executed Trades From The Jobbing Book</span><span class="count" style="color:#1a7a4a">' + fullyExec.length + ' record' + (fullyExec.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #a5d6a7;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead><tbody>' + stdRows(fullyExec) + '</tbody></table></div></div>' +

    '<div class="section-block"><div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082"><span class="icon">⚠️</span><span class="title" style="color:#b45309">Partially Executed Trades</span><span class="count" style="color:#b45309">' + partial.length + ' record' + (partial.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #ffe082;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Jobbed</th><th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th></tr></thead><tbody>' + partialRows + '</tbody></table></div></div>' +

    '<div class="section-block"><div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9"><span class="icon">🔵</span><span class="title" style="color:#1565c0">Executed Trades Not Jobbed (E-Trade Portal)</span><span class="count" style="color:#1565c0">' + notJobbed.length + ' record' + (notJobbed.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #90caf9;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead><tbody>' + stdRows(notJobbed) + '</tbody></table></div></div>' +

    (unexecuted.length > 0
      ? initialsStrip('Page ___') +
        pageRepeatHdr(FIRM, reportType, period) +
        '<div class="section-block"><div class="section-hdr" style="background:#fdecea;border:1px solid #fca5a5"><span class="icon">🔴</span><span class="title" style="color:#c0392b">Jobbed But Not Executed</span><span class="count" style="color:#c0392b">' + unexecuted.length + ' record' + (unexecuted.length !== 1 ? 's' : '') + '</span></div>' +
        '<div class="section-body" style="border:1px solid #fca5a5;border-top:none"><table><thead><tr><th>Ref No</th><th>Date</th><th>Expiry</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Side</th><th style="text-align:right">Jobbed Units</th><th>Entered By</th><th>Approved By</th></tr></thead><tbody>' + unexRows + '</tbody></table></div></div>'
      : '') +

    // ── Certification (final page) ──
    pageRepeatHdr(FIRM, reportType, period) +
    '<div class="cert-box"><div class="cert-title">Compliance Certification</div>' +
    '<div class="cert-text">I confirm that this Daily Trade Reconciliation Report for <strong>' + period + '</strong> is accurate and complete. All executed trades have been matched against the Jobbing Book. Partial fills and self-directed trades have been reviewed and acknowledged. This report has been prepared in accordance with the Firm\'s Internal Control Framework — Section 5a (Trading Controls) and NGX Rule 12.2.</div>' +
    exceptionsBlock +
    noteBlock +
    sigBlock() + '</div>' +

    '<div class="doc-ftr"><div>' + FIRM + ' — F-05 Daily Trade Reconciliation · ' + period + '</div><div>Session: ' + session.id + ' · Confidential</div></div>' +
    '</div>'

  openPrintWindow('F-05 Daily Reconciliation — ' + period, reportType, period, now, html)
}

// ── PERIOD ────────────────────────────────────────────────────────────────────
export function printPeriodF05({ sessions, allLines, periodLabel, periodType, dateRange }) {
  const now        = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const totalExec  = sessions.reduce((a, s) => a + (s.fully_executed_count || 0), 0)
  const totalPart  = sessions.reduce((a, s) => a + (s.partial_count || 0), 0)
  const totalEtrd  = sessions.reduce((a, s) => a + (s.not_jobbed_count || 0), 0)
  const totalUnex  = sessions.reduce((a, s) => a + (s.unexecuted_count || 0), 0)
  const totalAll   = totalExec + totalPart + totalEtrd
  const days       = sessions.length
  const pw         = periodType === 'weekly' ? 'Weekly' : periodType === 'monthly' ? 'Monthly' : 'Quarterly'
  const reportType = 'Form F-05 · ' + pw + ' Trade Reconciliation'

  const summaryRows = sessions.map(s => {
    const tot  = (s.fully_executed_count || 0) + (s.partial_count || 0) + (s.not_jobbed_count || 0)
    const unex = s.unexecuted_count || 0
    const icon = (s.partial_count || 0) > 0 ? '⚠️' : unex > 0 ? '🔴' : (s.not_jobbed_count || 0) > 0 ? '🔵' : '✅'
    return '<tr>' +
      '<td style="font-weight:600">' + fmtDShort(s.trade_date) + '</td>' +
      '<td style="text-align:center;color:#1a7a4a;font-weight:600">' + (s.fully_executed_count || 0) + '</td>' +
      '<td style="text-align:center;color:' + ((s.partial_count || 0) > 0 ? '#b45309' : '#6b7280') + ';font-weight:' + ((s.partial_count || 0) > 0 ? 700 : 400) + '">' + (s.partial_count || 0) + '</td>' +
      '<td style="text-align:center;color:#1565c0">' + (s.not_jobbed_count || 0) + '</td>' +
      '<td style="text-align:center;color:' + (unex > 0 ? '#c0392b' : '#6b7280') + ';font-weight:' + (unex > 0 ? 700 : 400) + '">' + unex + '</td>' +
      '<td style="text-align:center;font-weight:700">' + tot + '</td>' +
      '<td style="text-align:center">' + icon + '</td>' +
      (s.approver_note ? '<td style="font-size:7pt;color:#374151;max-width:100px">' + s.approver_note + '</td>' : '<td style="color:#9ca3af;font-size:7pt">—</td>') +
    '</tr>'
  }).join('') || '<tr><td colspan="8" class="no-data">No sessions in this period</td></tr>'

  const summaryFoot = sessions.length
    ? '<tfoot><tr>' +
      '<td>TOTAL (' + days + ' day' + (days !== 1 ? 's' : '') + ')</td>' +
      '<td style="text-align:center;color:#1a7a4a">' + totalExec + '</td>' +
      '<td style="text-align:center;color:#b45309">' + totalPart + '</td>' +
      '<td style="text-align:center;color:#1565c0">' + totalEtrd + '</td>' +
      '<td style="text-align:center;color:#c0392b">' + totalUnex + '</td>' +
      '<td style="text-align:center">' + totalAll + '</td>' +
      '<td colspan="2"></td></tr></tfoot>'
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

  const unexLines = allLines.filter(l => l.section_type === 'unexecuted')
  const unexRows  = unexLines.map(l =>
    '<tr><td style="font-weight:700;color:#c0392b">' + (l.ref_no || '—') + '</td>' +
    '<td>' + fmtDShort(l.effective_date) + '</td>' +
    '<td style="color:#b45309">' + fmtDShort(l.expiry_date) + '</td>' +
    '<td style="font-weight:600">' + (l.client || '—') + '</td>' +
    '<td style="font-family:monospace">' + (l.cscs_acc_num || '—') + '</td>' +
    '<td style="font-weight:700;font-family:monospace">' + (l.security || '—') + '</td>' +
    '<td>' + badge(l.order_type) + '</td>' +
    '<td style="text-align:right;font-weight:700;color:#c0392b">' + fmtN(l.units) + '</td>' +
    '<td style="font-size:7.5pt;color:#6b7280">' + (l.entered_by || '—') + '</td>' +
    '<td style="font-size:7.5pt;color:#6b7280">' + (l.approved_by || '—') + '</td></tr>'
  ).join('') || '<tr><td colspan="10" class="no-data">No unexecuted mandates in this period</td></tr>'

  const noteSessions = sessions.filter(s => s.approver_note)
  const notesBlock = noteSessions.length > 0
    ? '<div style="margin:10px 0;padding:10px 14px;background:#f0f4ff;border-left:3px solid #1e40af;border-radius:0 5px 5px 0">' +
      '<div style="font-size:7.5pt;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Head of Operations\' Explanations — Days with Exceptions</div>' +
      noteSessions.map(s =>
        '<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid #e0e7ff">' +
        '<div style="font-size:7.5pt;font-weight:700;color:#374151;margin-bottom:2px">' + fmtDShort(s.trade_date) + '</div>' +
        '<div style="font-size:9pt;color:#1a1a2e;line-height:1.6;font-style:italic">&ldquo;' + s.approver_note + '&rdquo;</div>' +
        '<div style="font-size:7pt;color:#6b7280;margin-top:2px">— ' + (s.approver_name || 'Operations') + '</div>' +
        '</div>'
      ).join('') +
      '</div>'
    : ''

  const html =
    '<div class="page">' +

    // First page header
    '<div class="doc-hdr">' +
    '<div><div class="firm">' + FIRM + '</div><div class="sub">Compliance Operations &nbsp;·&nbsp; ' + reportType + '</div></div>' +
    '<div class="doc-hdr-right">Printed: ' + now + '<br/>Period: ' + periodLabel + '</div>' +
    '</div>' +

    '<div class="report-title">' + pw + ' Trade Reconciliation Report</div>' +
    '<div class="report-sub"><strong>' + periodLabel + '</strong> &nbsp;·&nbsp; ' + dateRange + ' &nbsp;·&nbsp; ' + days + ' trading day' + (days !== 1 ? 's' : '') + '</div>' +

    '<div class="stat-row" style="grid-template-columns:repeat(5,1fr)">' +
      '<div class="stat-box" style="border-left:4px solid #0d1f3c"><div class="num" style="color:#0d1f3c">' + totalAll + '</div><div class="lbl">Total Trades</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1a7a4a"><div class="num" style="color:#1a7a4a">' + totalExec + '</div><div class="lbl">Fully Executed</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #b45309"><div class="num" style="color:#b45309">' + totalPart + '</div><div class="lbl">Partial Fills</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #1565c0"><div class="num" style="color:#1565c0">' + totalEtrd + '</div><div class="lbl">E-Trade</div></div>' +
      '<div class="stat-box" style="border-left:4px solid #c0392b"><div class="num" style="color:#c0392b">' + totalUnex + '</div><div class="lbl">Unexecuted</div></div>' +
    '</div>' +

    // Initials after stats
    initialsStrip('Page 1') +

    // Summary table
    pageRepeatHdr(FIRM, reportType, periodLabel) +
    '<div class="section-block"><div class="section-hdr" style="background:#f0f4ff;border:1px solid #c7d2fe"><span class="icon">📅</span><span class="title" style="color:#1e40af">' + pw + ' Summary — Trading Days</span><span class="count" style="color:#1e40af">' + days + ' session' + (days !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #c7d2fe;border-top:none"><table><thead><tr>' +
    '<th>Trade Date</th><th style="text-align:center">Executed</th><th style="text-align:center">Partial</th><th style="text-align:center">E-Trade</th><th style="text-align:center">Unexecuted</th><th style="text-align:center">Total</th><th style="text-align:center">Flag</th><th>Operations Note</th>' +
    '</tr></thead><tbody>' + summaryRows + '</tbody>' + summaryFoot + '</table></div></div>' +

    initialsStrip('Page ___') +

    // Detail sections
    pageRepeatHdr(FIRM, reportType, periodLabel) +
    '<div class="section-block"><div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082"><span class="icon">⚠️</span><span class="title" style="color:#b45309">Partial Fills — Full Detail</span><span class="count" style="color:#b45309">' + partialLines.length + ' record' + (partialLines.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #ffe082;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Order</th><th style="text-align:right">Jobbed</th><th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th></tr></thead><tbody>' + partialRows + '</tbody></table></div></div>' +

    '<div class="section-block"><div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9"><span class="icon">🔵</span><span class="title" style="color:#1565c0">Self-Directed Trades (E-Trade Portal) — Full Detail</span><span class="count" style="color:#1565c0">' + etLines.length + ' record' + (etLines.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #90caf9;border-top:none"><table><thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Order</th><th style="text-align:right">Units</th></tr></thead><tbody>' + etRows + '</tbody></table></div></div>' +

    '<div class="section-block"><div class="section-hdr" style="background:#fdecea;border:1px solid #fca5a5"><span class="icon">🔴</span><span class="title" style="color:#c0392b">Jobbed But Not Executed — Full Detail</span><span class="count" style="color:#c0392b">' + unexLines.length + ' record' + (unexLines.length !== 1 ? 's' : '') + '</span></div>' +
    '<div class="section-body" style="border:1px solid #fca5a5;border-top:none"><table><thead><tr><th>Ref No</th><th>Date</th><th>Expiry</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Side</th><th style="text-align:right">Jobbed Units</th><th>Entered By</th><th>Approved By</th></tr></thead><tbody>' + unexRows + '</tbody></table></div></div>' +

    // Certification (final page)
    pageRepeatHdr(FIRM, reportType, periodLabel) +
    '<div class="cert-box"><div class="cert-title">Compliance Certification</div>' +
    '<div class="cert-text">I confirm that this ' + pw + ' Trade Reconciliation Report covering <strong>' + periodLabel + '</strong> (' + dateRange + ') is accurate and complete. All ' + days + ' trading day' + (days !== 1 ? 's' : '') + ' in this period have been reconciled against the Jobbing Book. This report is produced in accordance with the Firm\'s Internal Control Framework — Section 5a (Trading Controls) and NGX Rule 12.2.</div>' +
    ((totalPart > 0 || totalUnex > 0)
      ? '<div style="margin:10px 0;padding:10px 14px;background:#fffbeb;border-left:3px solid #b45309;border-radius:0 5px 5px 0">' +
        '<div style="font-size:7.5pt;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px">Exceptions in This Period</div>' +
        (totalPart > 0 ? '<div style="font-size:8.5pt;color:#374151;margin-bottom:3px">⚠️ <strong>' + totalPart + ' partial fill(s)</strong> — see partial fills detail above.</div>' : '') +
        (totalUnex > 0 ? '<div style="font-size:8.5pt;color:#374151">🔴 <strong>' + totalUnex + ' unexecuted mandate(s)</strong> — client instructions jobbed but not traded on NGX. See detail above.</div>' : '') +
        '</div>'
      : '') +
    notesBlock +
    sigBlock() + '</div>' +

    '<div class="doc-ftr"><div>' + FIRM + ' — F-05 ' + pw + ' Trade Reconciliation · ' + periodLabel + '</div><div>Confidential · Internal Use Only</div></div>' +
    '</div>'

  openPrintWindow('F-05 ' + pw + ' Reconciliation — ' + periodLabel, reportType, periodLabel, now, html)
}
