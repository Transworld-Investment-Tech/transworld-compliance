// ── F-05 Print / PDF Report Generator ────────────────────────────────────────
// Shared print logic for Daily, Weekly, Monthly and Quarterly F-05 reports

const FIRM = 'Transworld Investment and Securities Limited'

// ── Shared CSS for all print reports ────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 10pt; }
  .page { padding: 15mm 18mm; max-width: 210mm; margin: 0 auto; }
  .hdr { border-bottom: 3px solid #0d1f3c; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .hdr-left .firm { font-size: 14pt; font-weight: 700; color: #0d1f3c; }
  .hdr-left .sub { font-size: 7.5pt; color: #6b7280; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px; }
  .hdr-right { text-align: right; font-size: 8pt; color: #6b7280; }
  .report-title { font-size: 17pt; font-weight: 700; color: #0d1f3c; margin-bottom: 3px; }
  .report-sub { font-size: 9pt; color: #6b7280; margin-bottom: 14px; }
  .stat-row { display: grid; gap: 10px; margin-bottom: 16px; }
  .stat-box { border-radius: 6px; padding: 10px 14px; border: 1px solid #e5e7eb; }
  .stat-box .num { font-size: 22pt; font-weight: 700; line-height: 1; }
  .stat-box .lbl { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 3px; }
  .section-hdr { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px 6px 0 0; margin-top: 14px; }
  .section-hdr .icon { font-size: 14pt; }
  .section-hdr .title { font-weight: 700; font-size: 10.5pt; }
  .section-hdr .count { margin-left: auto; font-size: 9pt; font-weight: 700; padding: 2px 10px; border-radius: 20px; background: rgba(255,255,255,0.5); }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { padding: 6px 8px; background: #0d1f3c; color: #fff; text-align: left; font-weight: 600; font-size: 7.5pt; letter-spacing: 0.3px; }
  td { padding: 5px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  tr:nth-child(even) td { background: #f9fafb; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 20px; font-size: 7.5pt; font-weight: 700; }
  .badge-sell { background: #fdecea; color: #c0392b; }
  .badge-buy  { background: #e8f5e9; color: #1a7a4a; }
  .badge-mix  { background: #e3f0ff; color: #1565c0; }
  .outstanding { color: #b45309; font-weight: 700; }
  .cert-box { margin-top: 18px; border: 1.5px solid #0d1f3c; border-radius: 8px; padding: 14px 18px; }
  .cert-title { font-weight: 700; font-size: 10pt; color: #0d1f3c; margin-bottom: 8px; }
  .cert-text { font-size: 8.5pt; color: #374151; line-height: 1.6; margin-bottom: 14px; }
  .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 4px; }
  .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
  .sig-label { font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .sig-name  { font-size: 9pt; font-weight: 600; color: #0d1f3c; margin-top: 18px; }
  .ftr { margin-top: 14px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 7.5pt; color: #9ca3af; }
  .summary-table th { font-size: 8pt; }
  .summary-table td { font-size: 9pt; }
  .no-data { text-align: center; color: #9ca3af; padding: 16px; font-style: italic; font-size: 8.5pt; }
  @page { size: A4; margin: 0; }
  @media print { .page { padding: 15mm 18mm; } }
`

function openPrintWindow(title, bodyHtml) {
  const w = window.open('', '_blank')
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>${title}</title>
    <style>${PRINT_CSS}</style>
  </head><body>${bodyHtml}</body></html>`)
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 300) }
}

function fmtD(d) {
  if (!d) return '—'
  const safe = String(d).includes('T') ? d : d + 'T12:00:00'
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtN(v) {
  if (v === null || v === undefined) return '—'
  return Number(v).toLocaleString()
}

function orderBadge(type) {
  if (type === 'SELL') return `<span class="badge badge-sell">SELL</span>`
  if (type === 'BUY')  return `<span class="badge badge-buy">BUY</span>`
  return `<span class="badge badge-mix">${type || '—'}</span>`
}

// ── DAILY REPORT ─────────────────────────────────────────────────────────────
export function printDailyF05(session) {
  if (!session) return
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const approvedAt = session.approved_at
    ? new Date(session.approved_at).toLocaleString('en-GB')
    : '—'

  const fullyExec = (session.lines || []).filter(l => l.section_type === 'fully_executed')
  const partial   = (session.lines || []).filter(l => l.section_type === 'partial')
  const notJobbed = (session.lines || []).filter(l => l.section_type === 'not_jobbed')

  const fullyExecRows = fullyExec.length
    ? fullyExec.map((l, i) => `
      <tr>
        <td>${l.effective_date || '—'}</td>
        <td style="font-weight:600">${l.client || '—'}</td>
        <td style="font-family:monospace;font-size:8pt">${l.cscs_acc_num || '—'}</td>
        <td>${orderBadge(l.order_type)}</td>
        <td style="font-weight:700;font-family:monospace">${l.security || '—'}</td>
        <td style="text-align:right">${fmtN(l.units)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="no-data">No fully executed trades on this date</td></tr>`

  const partialRows = partial.length
    ? partial.map(l => `
      <tr>
        <td>${l.effective_date || '—'}</td>
        <td style="font-weight:600">${l.client || '—'}</td>
        <td style="font-family:monospace;font-size:8pt">${l.cscs_acc_num || '—'}</td>
        <td>${orderBadge(l.order_type)}</td>
        <td style="font-weight:700;font-family:monospace">${l.security || '—'}</td>
        <td style="text-align:right">${fmtN(l.units_jobbed)}</td>
        <td style="text-align:right;color:#1a7a4a;font-weight:600">${fmtN(l.units_traded)}</td>
        <td style="text-align:right" class="outstanding">${fmtN(l.units_outstanding)} ⚠</td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="no-data">No partial fills on this date</td></tr>`

  const notJobbedRows = notJobbed.length
    ? notJobbed.map(l => `
      <tr>
        <td>${l.effective_date || '—'}</td>
        <td style="font-weight:600">${l.client || '—'}</td>
        <td style="font-family:monospace;font-size:8pt">${l.cscs_acc_num || '—'}</td>
        <td>${orderBadge(l.order_type)}</td>
        <td style="font-weight:700;font-family:monospace">${l.security || '—'}</td>
        <td style="text-align:right">${fmtN(l.units)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="no-data">No self-directed trades on this date</td></tr>`

  const html = `
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        <div class="firm">${FIRM}</div>
        <div class="sub">Compliance Operations · F-05 Daily Trade Reconciliation Report</div>
      </div>
      <div class="hdr-right">Printed: ${now}<br/>Form F-05 · Daily</div>
    </div>

    <div class="report-title">Daily Trade Reconciliation Report</div>
    <div class="report-sub">
      Trade Date: <strong>${fmtD(session.trade_date)}</strong> &nbsp;·&nbsp;
      Approved by: <strong>${session.approver_name || '—'}</strong> &nbsp;·&nbsp;
      ${approvedAt}
      ${session.approver_note ? `<br/>Note: ${session.approver_note}` : ''}
    </div>

    <div class="stat-row" style="grid-template-columns:1fr 1fr 1fr">
      <div class="stat-box" style="border-left:4px solid #1a7a4a">
        <div class="num" style="color:#1a7a4a">${session.fully_executed_count || 0}</div>
        <div class="lbl">Fully Executed</div>
      </div>
      <div class="stat-box" style="border-left:4px solid #b45309">
        <div class="num" style="color:#b45309">${session.partial_count || 0}</div>
        <div class="lbl">Partial Fills</div>
      </div>
      <div class="stat-box" style="border-left:4px solid #1565c0">
        <div class="num" style="color:#1565c0">${session.not_jobbed_count || 0}</div>
        <div class="lbl">Self-Directed (E-Trade)</div>
      </div>
    </div>

    <!-- Fully Executed -->
    <div class="section-hdr" style="background:#e8f5e9;border:1px solid #a5d6a7">
      <span class="icon">✅</span>
      <span class="title" style="color:#1a7a4a">Fully Executed Trades From The Jobbing Book</span>
      <span class="count" style="color:#1a7a4a">${fullyExec.length} record${fullyExec.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #a5d6a7;border-top:none;border-radius:0 0 6px 6px;margin-bottom:6px">
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead>
        <tbody>${fullyExecRows}</tbody>
      </table>
    </div>

    <!-- Partial -->
    <div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082">
      <span class="icon">⚠️</span>
      <span class="title" style="color:#b45309">Partially Executed Trades</span>
      <span class="count" style="color:#b45309">${partial.length} record${partial.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #ffe082;border-top:none;border-radius:0 0 6px 6px;margin-bottom:6px">
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Jobbed</th><th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th></tr></thead>
        <tbody>${partialRows}</tbody>
      </table>
    </div>

    <!-- Not Jobbed -->
    <div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9">
      <span class="icon">🔵</span>
      <span class="title" style="color:#1565c0">Executed Trades Not Jobbed (E-Trade Portal)</span>
      <span class="count" style="color:#1565c0">${notJobbed.length} record${notJobbed.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #90caf9;border-top:none;border-radius:0 0 6px 6px;margin-bottom:6px">
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Order</th><th>Security</th><th style="text-align:right">Units</th></tr></thead>
        <tbody>${notJobbedRows}</tbody>
      </table>
    </div>

    <div class="cert-box">
      <div class="cert-title">Compliance Certification</div>
      <div class="cert-text">
        I confirm that this Daily Trade Reconciliation Report for <strong>${fmtD(session.trade_date)}</strong> is accurate and complete.
        All executed trades have been matched against the Jobbing Book. Partial fills and self-directed trades have been reviewed and acknowledged.
        This report has been prepared in accordance with the Firm's Internal Control Framework — Section 5a (Trading Controls)
        and NGX Rule 12.2.
      </div>
      <div class="sig-row">
        <div class="sig-field">
          <div class="sig-label">Prepared / Approved By</div>
          <div class="sig-name">${session.approver_name || '___________________'}</div>
          <div style="font-size:7.5pt;color:#6b7280;margin-top:2px">${approvedAt}</div>
        </div>
        <div class="sig-field">
          <div class="sig-label">Head of Trading</div>
          <div class="sig-name" style="color:#aaa">___________________</div>
          <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Signature &amp; Date</div>
        </div>
        <div class="sig-field">
          <div class="sig-label">Compliance Officer</div>
          <div class="sig-name" style="color:#aaa">___________________</div>
          <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Signature &amp; Date</div>
        </div>
      </div>
    </div>

    <div class="ftr">
      <div>${FIRM} — F-05 Daily Trade Reconciliation</div>
      <div>Session ID: ${session.id} · Confidential</div>
    </div>
  </div>`

  openPrintWindow(`F-05 Daily Reconciliation — ${fmtD(session.trade_date)}`, html)
}

// ── PERIOD REPORT (Weekly / Monthly / Quarterly) ──────────────────────────────
export function printPeriodF05({ sessions, allLines, periodLabel, periodType, dateRange, preparedBy }) {
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })

  const totalExecuted = sessions.reduce((a, s) => a + (s.fully_executed_count || 0), 0)
  const totalPartial  = sessions.reduce((a, s) => a + (s.partial_count || 0), 0)
  const totalEtrade   = sessions.reduce((a, s) => a + (s.not_jobbed_count || 0), 0)
  const totalTrades   = totalExecuted + totalPartial + totalEtrade
  const tradingDays   = sessions.length

  // ── Session summary table ──────────────────────────────────────────────────
  const sessionRows = sessions.length
    ? sessions.map(s => `
      <tr>
        <td style="font-weight:600">${fmtD(s.trade_date)}</td>
        <td style="text-align:center;color:#1a7a4a;font-weight:600">${s.fully_executed_count || 0}</td>
        <td style="text-align:center;color:${(s.partial_count || 0) > 0 ? '#b45309' : '#6b7280'};font-weight:${(s.partial_count || 0) > 0 ? 700 : 400}">${s.partial_count || 0}</td>
        <td style="text-align:center;color:#1565c0">${s.not_jobbed_count || 0}</td>
        <td style="text-align:center;font-weight:600">${(s.fully_executed_count || 0) + (s.partial_count || 0) + (s.not_jobbed_count || 0)}</td>
        <td style="font-size:8pt;color:#6b7280">${s.approver_name || '—'}</td>
        <td>${(s.partial_count || 0) > 0 ? '⚠️' : (s.not_jobbed_count || 0) > 0 ? '🔵' : '✅'}</td>
      </tr>`).join('')
    : `<tr><td colspan="7" class="no-data">No trading sessions recorded in this period</td></tr>`

  // ── All partial fills in period ────────────────────────────────────────────
  const partialLines = allLines.filter(l => l.section_type === 'partial')
  const partialRows = partialLines.length
    ? partialLines.map(l => `
      <tr>
        <td>${l.effective_date || '—'}</td>
        <td style="font-weight:600">${l.client || '—'}</td>
        <td style="font-family:monospace;font-size:8pt">${l.cscs_acc_num || '—'}</td>
        <td style="font-weight:700;font-family:monospace">${l.security || '—'}</td>
        <td>${orderBadge(l.order_type)}</td>
        <td style="text-align:right">${fmtN(l.units_jobbed)}</td>
        <td style="text-align:right;color:#1a7a4a;font-weight:600">${fmtN(l.units_traded)}</td>
        <td style="text-align:right" class="outstanding">${fmtN(l.units_outstanding)}</td>
      </tr>`).join('')
    : `<tr><td colspan="8" class="no-data">No partial fills in this period</td></tr>`

  // ── All not-jobbed trades ──────────────────────────────────────────────────
  const etLines = allLines.filter(l => l.section_type === 'not_jobbed')
  const etRows = etLines.length
    ? etLines.map(l => `
      <tr>
        <td>${l.effective_date || '—'}</td>
        <td style="font-weight:600">${l.client || '—'}</td>
        <td style="font-family:monospace;font-size:8pt">${l.cscs_acc_num || '—'}</td>
        <td style="font-weight:700;font-family:monospace">${l.security || '—'}</td>
        <td>${orderBadge(l.order_type)}</td>
        <td style="text-align:right">${fmtN(l.units)}</td>
      </tr>`).join('')
    : `<tr><td colspan="6" class="no-data">No self-directed trades in this period</td></tr>`

  // ── Per-period group heading ───────────────────────────────────────────────
  const periodIcon = periodType === 'weekly' ? 'Week' : periodType === 'monthly' ? 'Month' : 'Quarter'

  const html = `
  <div class="page">
    <div class="hdr">
      <div class="hdr-left">
        <div class="firm">${FIRM}</div>
        <div class="sub">Compliance Operations · F-05 Trade Reconciliation — ${periodIcon}ly Report</div>
      </div>
      <div class="hdr-right">Printed: ${now}<br/>Form F-05 · ${periodIcon}ly</div>
    </div>

    <div class="report-title">${periodIcon}ly Trade Reconciliation Report</div>
    <div class="report-sub">
      Period: <strong>${periodLabel}</strong> &nbsp;·&nbsp;
      ${dateRange} &nbsp;·&nbsp;
      ${tradingDays} trading day${tradingDays !== 1 ? 's' : ''}
    </div>

    <div class="stat-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-box" style="border-left:4px solid #0d1f3c">
        <div class="num" style="color:#0d1f3c">${totalTrades}</div>
        <div class="lbl">Total Trades</div>
      </div>
      <div class="stat-box" style="border-left:4px solid #1a7a4a">
        <div class="num" style="color:#1a7a4a">${totalExecuted}</div>
        <div class="lbl">Fully Executed</div>
      </div>
      <div class="stat-box" style="border-left:4px solid #b45309">
        <div class="num" style="color:#b45309">${totalPartial}</div>
        <div class="lbl">Partial Fills</div>
      </div>
      <div class="stat-box" style="border-left:4px solid #1565c0">
        <div class="num" style="color:#1565c0">${totalEtrade}</div>
        <div class="lbl">E-Trade (Not Jobbed)</div>
      </div>
    </div>

    <!-- Day-by-day summary -->
    <div class="section-hdr" style="background:#f0f4ff;border:1px solid #c7d2fe;margin-top:0">
      <span class="icon">📅</span>
      <span class="title" style="color:#1e40af">${periodIcon}ly Summary — Trading Days</span>
      <span class="count" style="color:#1e40af">${tradingDays} sessions</span>
    </div>
    <div style="border:1px solid #c7d2fe;border-top:none;border-radius:0 0 6px 6px;margin-bottom:8px">
      <table class="summary-table">
        <thead>
          <tr>
            <th>Trade Date</th>
            <th style="text-align:center">Executed</th>
            <th style="text-align:center">Partial</th>
            <th style="text-align:center">E-Trade</th>
            <th style="text-align:center">Total</th>
            <th>Approved By</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${sessionRows}</tbody>
        ${sessions.length > 0 ? `
        <tfoot>
          <tr style="background:#f0f4ff;font-weight:700">
            <td>TOTAL</td>
            <td style="text-align:center;color:#1a7a4a">${totalExecuted}</td>
            <td style="text-align:center;color:#b45309">${totalPartial}</td>
            <td style="text-align:center;color:#1565c0">${totalEtrade}</td>
            <td style="text-align:center">${totalTrades}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>

    <!-- Partial fills detail -->
    <div class="section-hdr" style="background:#fff8e1;border:1px solid #ffe082">
      <span class="icon">⚠️</span>
      <span class="title" style="color:#b45309">Partial Fills — Full Detail</span>
      <span class="count" style="color:#b45309">${partialLines.length} record${partialLines.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #ffe082;border-top:none;border-radius:0 0 6px 6px;margin-bottom:8px">
      <table>
        <thead><tr>
          <th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th>
          <th>Order</th><th style="text-align:right">Jobbed</th>
          <th style="text-align:right">Traded</th><th style="text-align:right">Outstanding</th>
        </tr></thead>
        <tbody>${partialRows}</tbody>
      </table>
    </div>

    <!-- E-trade detail -->
    <div class="section-hdr" style="background:#e3f0ff;border:1px solid #90caf9">
      <span class="icon">🔵</span>
      <span class="title" style="color:#1565c0">Self-Directed Trades (E-Trade Portal) — Full Detail</span>
      <span class="count" style="color:#1565c0">${etLines.length} record${etLines.length !== 1 ? 's' : ''}</span>
    </div>
    <div style="border:1px solid #90caf9;border-top:none;border-radius:0 0 6px 6px;margin-bottom:8px">
      <table>
        <thead><tr><th>Date</th><th>Client</th><th>CSCS No</th><th>Security</th><th>Order</th><th style="text-align:right">Units</th></tr></thead>
        <tbody>${etRows}</tbody>
      </table>
    </div>

    <div class="cert-box">
      <div class="cert-title">Compliance Certification</div>
      <div class="cert-text">
        I confirm that this ${periodIcon}ly Trade Reconciliation Report covering <strong>${periodLabel}</strong> (${dateRange}) is accurate and complete.
        All ${tradingDays} trading day${tradingDays !== 1 ? 's' : ''} in this period have been reconciled against the Jobbing Book.
        This report is produced in accordance with the Firm's Internal Control Framework — Section 5a (Trading Controls) and NGX Rule 12.2.
      </div>
      <div class="sig-row">
        <div class="sig-field">
          <div class="sig-label">Prepared By (Operations)</div>
          <div class="sig-name" style="color:#aaa">___________________</div>
          <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Signature &amp; Date</div>
        </div>
        <div class="sig-field">
          <div class="sig-label">Head of Trading</div>
          <div class="sig-name" style="color:#aaa">___________________</div>
          <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Signature &amp; Date</div>
        </div>
        <div class="sig-field">
          <div class="sig-label">Compliance Officer</div>
          <div class="sig-name" style="color:#aaa">___________________</div>
          <div style="font-size:7.5pt;color:#aaa;margin-top:2px">Signature &amp; Date</div>
        </div>
      </div>
    </div>

    <div class="ftr">
      <div>${FIRM} — F-05 ${periodIcon}ly Trade Reconciliation</div>
      <div>${periodLabel} · Confidential · Internal Use Only</div>
    </div>
  </div>`

  openPrintWindow(`F-05 ${periodIcon}ly Reconciliation — ${periodLabel}`, html)
}
