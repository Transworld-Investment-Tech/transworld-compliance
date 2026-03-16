import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import F06DetectionModule from './F06DetectionModule'

// ── Constants ─────────────────────────────────────────────────────────────────
const NAV   = '#0d1f3c'
const GOLD  = '#c9a84c'
const GREEN = '#1a7a4a'
const GREEN_BG = '#e8f5e9'
const AMBER = '#b45309'
const AMBER_BG = '#fff8e1'
const RED   = '#c0392b'
const RED_BG = '#fdecea'
const BLUE  = '#1565c0'
const BLUE_BG = '#e3f0ff'
const BORDER = '#dde1ea'
const SURFACE = '#f7f8fa'

const FIRM = 'Transworld Investment and Securities Limited'

// ── Error types from Policy Section 3.1 ──────────────────────────────────────
const ERROR_TYPES = [
  { value: 'wrong_price_quantity', label: 'Type 1 — Wrong Price or Quantity',    short: 'Wrong Price/Qty' },
  { value: 'wrong_security',       label: 'Type 2 — Wrong Security or Instrument', short: 'Wrong Security' },
  { value: 'wrong_account',        label: 'Type 3 — Wrong Client Account',        short: 'Wrong Account' },
  { value: 'duplicate',            label: 'Type 4 — Duplicate Trade',             short: 'Duplicate' },
  { value: 'omitted',              label: 'Type 5 — Omitted Trade',               short: 'Omitted Trade' },
  { value: 'late_execution',       label: 'Type 6 — Late Execution',              short: 'Late Execution' },
  { value: 'unauthorised',         label: 'Type 7 — Unauthorised Trade',          short: 'Unauthorised' },
  { value: 'system_error',         label: 'Type 8 — System or Technical Error',   short: 'System Error' },
]

const ROOT_CAUSES = [
  { value: 'human_data_entry',    label: '1 — Human data entry error' },
  { value: 'process_gap',         label: '2 — Process gap' },
  { value: 'system_failure',      label: '3 — System / technology failure' },
  { value: 'misread_mandate',     label: '4 — Misread or missing mandate' },
  { value: 'insufficient_controls', label: '5 — Insufficient controls' },
  { value: 'external_factor',     label: '6 — External factor' },
]

// ── Urgency classification per Policy Section 7.1 ─────────────────────────────
function classifyUrgency(impactClient) {
  const abs = Math.abs(Number(impactClient) || 0)
  if (abs >= 500000) return 'CRITICAL'
  if (abs >= 50000)  return 'HIGH'
  return 'STANDARD'
}

function urgencyConfig(level) {
  if (level === 'CRITICAL') return { color: RED,   bg: RED_BG,   border: '#fca5a5', label: 'CRITICAL',  desc: '≥ ₦500,000 — Immediate NGX escalation required' }
  if (level === 'HIGH')     return { color: AMBER, bg: AMBER_BG, border: '#ffe082', label: 'HIGH',      desc: '₦50,000–₦499,999 — NGX notification within 2 working days' }
  return                            { color: GREEN, bg: GREEN_BG, border: '#a5d6a7', label: 'STANDARD',  desc: 'Below ₦50,000 — Internal management only' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtN(v) {
  const n = Number(v)
  if (!v && v !== 0) return '—'
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d)
  const safe = s.length === 10 ? s + 'T12:00:00' : s
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function today() { return new Date().toISOString().split('T')[0] }

// ── Print / PDF ───────────────────────────────────────────────────────────────
function printF06(entry) {
  if (!entry) return
  const now  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const urg  = urgencyConfig(entry.urgency)
  const errType = ERROR_TYPES.find(t => t.value === entry.error_type)
  const rootCat = ROOT_CAUSES.find(r => r.value === entry.root_cause_category)

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; font-size: 9pt; }
    @page {
      size: A4 portrait; margin: 14mm 16mm;
      @top-left   { content: "${FIRM}"; font-family: Arial; font-size: 7pt; color: #6b7280; }
      @top-right  { content: "Form F-06 · Error Trade GL · ${entry.ref_number}"; font-family: Arial; font-size: 7pt; color: #6b7280; }
      @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: Arial; font-size: 7pt; color: #9ca3af; }
      @bottom-right { content: "Printed: ${now}"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
      @bottom-left { content: "Confidential — Internal Use Only"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
    }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
    .field-label { font-size: 7pt; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
    .field-value { font-size: 9pt; color: #1a1a2e; padding: 4px 0; border-bottom: 1px solid #e5e7eb; }
    .section { margin-top: 14px; }
    .section-title { font-size: 8pt; font-weight: 700; color: #0d1f3c; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #0d1f3c; padding-bottom: 3px; margin-bottom: 10px; }
    .urgency-box { padding: 8px 12px; border-radius: 5px; margin-bottom: 12px; border: 1.5px solid; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 8px; }
    .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
    .sig-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; }
    .sig-line { margin-top: 20px; border-bottom: 1px solid #374151; }
    .sig-sub { font-size: 7pt; color: #9ca3af; margin-top: 3px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 8pt; font-weight: 700; }
    tr { page-break-inside: avoid; }
    @media print { .page { padding: 0; } }
  `

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>F-06 ${entry.ref_number}</title><style>${css}</style>
  </head><body>
  <div style="padding:0;max-width:100%">

    <div style="border-bottom:3px solid #0d1f3c;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:13pt;font-weight:700;color:#0d1f3c">${FIRM}</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px">Compliance Operations · Form F-06 · Error Trade General Ledger Recording Form</div>
      </div>
      <div style="text-align:right;font-size:8pt;color:#6b7280">Printed: ${now}<br/>Ref: <strong>${entry.ref_number}</strong></div>
    </div>

    <div style="font-size:15pt;font-weight:700;color:#0d1f3c;margin-bottom:2px">Error Trade GL Recording Form</div>
    <div style="font-size:8.5pt;color:#6b7280;margin-bottom:14px">Reference: <strong>${entry.ref_number}</strong> &nbsp;·&nbsp; Logged: ${new Date(entry.logged_at).toLocaleString('en-GB')} &nbsp;·&nbsp; By: ${entry.logged_by}</div>

    <div class="urgency-box" style="background:${urg.bg};border-color:${urg.border}">
      <span style="font-size:8pt;font-weight:700;color:${urg.color};text-transform:uppercase;letter-spacing:0.5px">${urg.label} URGENCY</span>
      <span style="font-size:8pt;color:#374151;margin-left:10px">${urg.desc}</span>
    </div>

    <div class="section">
      <div class="section-title">1. Error Identification</div>
      <div class="row">
        <div><div class="field-label">Error Type</div><div class="field-value">${errType?.label || entry.error_type}</div></div>
        <div><div class="field-label">Security / Instrument</div><div class="field-value">${entry.security}</div></div>
      </div>
      <div class="row">
        <div><div class="field-label">Date of Error (Trade Date)</div><div class="field-value">${fmtDate(entry.error_date)}</div></div>
        <div><div class="field-label">Date Discovered</div><div class="field-value">${fmtDate(entry.discovery_date)}</div></div>
      </div>
      <div class="row">
        <div><div class="field-label">Client Account Number</div><div class="field-value">${entry.client_account}</div></div>
        <div><div class="field-label">Client Name</div><div class="field-value">${entry.client_name || '—'}</div></div>
      </div>
      ${entry.cscs_no ? `<div style="margin-bottom:10px"><div class="field-label">CSCS Number</div><div class="field-value">${entry.cscs_no}</div></div>` : ''}
      <div style="margin-bottom:10px">
        <div class="field-label">Error Description — What Was Instructed vs. What Was Executed</div>
        <div style="font-size:9pt;color:#1a1a2e;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;line-height:1.7;margin-top:3px">${entry.error_description}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Financial Impact &amp; GL Account</div>
      <div class="row">
        <div><div class="field-label">Financial Impact to Client (₦)</div><div class="field-value" style="font-weight:700;color:${Number(entry.impact_client) < 0 ? RED : GREEN}">${fmtN(entry.impact_client)}</div></div>
        <div><div class="field-label">Financial Impact to Firm — Net (₦)</div><div class="field-value" style="font-weight:700">${fmtN(entry.impact_firm)}</div></div>
      </div>
      <div class="row">
        <div><div class="field-label">Compensation Paid to Client (₦)</div><div class="field-value">${fmtN(entry.compensation_paid)}</div></div>
        <div><div class="field-label">Compensation Date</div><div class="field-value">${fmtDate(entry.compensation_date)}</div></div>
      </div>
      <div style="margin-bottom:10px">
        <div class="field-label">GL Account Entry Reference</div>
        <div class="field-value">${entry.gl_entry_ref || '— Pending —'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">3. Root Cause Analysis</div>
      <div style="margin-bottom:10px">
        <div class="field-label">Root Cause Category</div>
        <div class="field-value">${rootCat?.label || entry.root_cause_category}</div>
      </div>
      <div style="margin-bottom:10px">
        <div class="field-label">Root Cause Detail</div>
        <div style="font-size:9pt;color:#1a1a2e;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;line-height:1.7;margin-top:3px">${entry.root_cause_detail || '—'}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">4. Corrective Action</div>
      <div style="margin-bottom:10px">
        <div class="field-label">Corrective Action Taken</div>
        <div style="font-size:9pt;color:#1a1a2e;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;line-height:1.7;margin-top:3px">${entry.corrective_action}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">5. Client &amp; Regulatory Obligations</div>
      <div class="row">
        <div><div class="field-label">Client Informed</div><div class="field-value">${entry.client_informed ? '✓ Yes — ' + fmtDate(entry.client_informed_date) : '✗ No / Pending'}</div></div>
        <div><div class="field-label">NGX Report Required (Rule 12.2(e))</div><div class="field-value" style="font-weight:700;color:${entry.ngx_report_required ? RED : GREEN}">${entry.ngx_report_required ? 'YES' : 'No'}</div></div>
      </div>
      <div class="row">
        <div><div class="field-label">NGX Report Filed</div><div class="field-value">${entry.ngx_report_filed ? '✓ Filed — ' + fmtDate(entry.ngx_report_date) : (entry.ngx_report_required ? '✗ Not Yet Filed' : 'N/A')}</div></div>
        <div><div class="field-label">Status</div><div class="field-value" style="font-weight:700;text-transform:uppercase">${entry.status}</div></div>
      </div>
      ${entry.notes ? `<div style="margin-bottom:10px"><div class="field-label">Additional Notes</div><div style="font-size:9pt;color:#1a1a2e;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:4px;line-height:1.7;margin-top:3px">${entry.notes}</div></div>` : ''}
    </div>

    <div style="margin-top:16px;border:1.5px solid #0d1f3c;border-radius:7px;padding:12px 16px;page-break-inside:avoid">
      <div style="font-weight:700;font-size:10pt;color:#0d1f3c;margin-bottom:6px">Compliance Certification</div>
      <div style="font-size:8pt;color:#374151;line-height:1.65;margin-bottom:14px">
        I confirm that this Error Trade GL Recording Form for reference <strong>${entry.ref_number}</strong> is accurate and complete.
        The financial impact has been assessed against the NGX Rule 12.2(e) reporting thresholds.
        All required corrective actions and client communications have been initiated in accordance with the Firm's
        Error Trade Policy v3.0 and Internal Control Framework — Section 5a (Trading Controls).
      </div>
      ${entry.co_signoff ? `<div style="padding:8px 12px;background:#f0f4ff;border-left:3px solid #1e40af;border-radius:0 4px 4px 0;margin-bottom:14px;font-size:8.5pt;color:#374151">
        <strong>Compliance Officer Sign-off:</strong> ${entry.co_signoff} &nbsp;·&nbsp; ${entry.co_signoff_at ? new Date(entry.co_signoff_at).toLocaleString('en-GB') : '—'}
      </div>` : ''}
      <div class="sig-row">
        <div class="sig-field"><div class="sig-label">Logged By (Operations)</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Head of Operations</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Compliance Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
      </div>
    </div>

    <div style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:6px;display:flex;justify-content:space-between;font-size:7pt;color:#9ca3af">
      <div>${FIRM} — F-06 Error Trade GL Recording Form</div>
      <div>${entry.ref_number} · Confidential · Rule 12.2 Compliant</div>
    </div>
  </div>
  </body></html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.onload = () => { setTimeout(() => w.print(), 400) }
}

// ── Input style helpers ───────────────────────────────────────────────────────
const inp = { width: '100%', padding: '8px 11px', border: `1.5px solid ${BORDER}`, borderRadius: 7, fontFamily: 'inherit', fontSize: 13, color: NAV, outline: 'none', background: '#fff' }
const lbl = { display: 'block', fontSize: 10.5, fontWeight: 700, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }
const tdS = { padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, fontSize: 12, verticalAlign: 'middle' }
const thS = { padding: '8px 12px', background: NAV, color: '#fff', fontSize: 10, fontWeight: 600, textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }

// ── EMPTY FORM STATE ──────────────────────────────────────────────────────────
const EMPTY = {
  error_date: today(), discovery_date: today(),
  error_type: '', security: '', client_account: '', client_name: '', cscs_no: '',
  error_description: '', impact_client: '', impact_firm: '', compensation_paid: '0',
  compensation_date: '', root_cause_category: '', root_cause_detail: '',
  corrective_action: '', gl_entry_ref: '', client_informed: false, client_informed_date: '',
  ngx_report_required: false, ngx_report_filed: false, ngx_report_date: '', notes: '',
  linked_f04_id: '', linked_f05_id: '',
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function F06ErrorTradeLog({ currentUser }) {
  const [view,    setView]    = useState('log')   // log | new | detail | detect
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [form,    setForm]    = useState(EMPTY)
  const [saving,  setSaving]  = useState(false)
  const [errors,  setErrors]  = useState({})
  const [selected, setSelected] = useState(null)
  const [weeklyStats, setWeeklyStats] = useState(null)

  useEffect(() => { loadEntries(); loadWeekly() }, [])

  async function loadEntries() {
    const { data } = await supabase
      .from('f06_error_trades')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(50)
    setEntries(data || [])
    setLoading(false)
  }

  async function loadWeekly() {
    // Current week Monday
    const now = new Date()
    const day = now.getDay()
    const mon = new Date(now)
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
    const weekStart = mon.toISOString().split('T')[0]

    const { data } = await supabase
      .from('f06_error_trades')
      .select('impact_client, ngx_report_required, ref_number')
      .gte('error_date', weekStart)

    if (data && data.length > 0) {
      const total = data.reduce((a, r) => a + Math.abs(Number(r.impact_client) || 0), 0)
      setWeeklyStats({ total, count: data.length, weekStart, triggered: total >= 500000 })
    } else {
      setWeeklyStats({ total: 0, count: 0, weekStart, triggered: false })
    }
  }

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const urgency = classifyUrgency(form.impact_client)
  const urgCfg  = urgencyConfig(urgency)

  function validate() {
    const e = {}
    if (!form.error_date)          e.error_date = 'Required'
    if (!form.discovery_date)      e.discovery_date = 'Required'
    if (!form.error_type)          e.error_type = 'Required'
    if (!form.security)            e.security = 'Required'
    if (!form.client_account)      e.client_account = 'Required'
    if (!form.error_description)   e.error_description = 'Required'
    if (form.impact_client === '') e.impact_client = 'Required — enter 0 if no financial impact'
    if (!form.root_cause_category) e.root_cause_category = 'Required'
    if (!form.corrective_action)   e.corrective_action = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function saveEntry() {
    if (!validate()) return
    setSaving(true)

    const ngxRequired = urgency === 'CRITICAL' || urgency === 'HIGH'
    const payload = {
      ref_number:          '',  // auto-generated by trigger
      error_date:          form.error_date,
      discovery_date:      form.discovery_date,
      error_type:          form.error_type,
      security:            form.security,
      client_account:      form.client_account,
      client_name:         form.client_name || null,
      cscs_no:             form.cscs_no || null,
      error_description:   form.error_description,
      impact_client:       Number(form.impact_client) || 0,
      impact_firm:         Number(form.impact_firm) || 0,
      compensation_paid:   Number(form.compensation_paid) || 0,
      compensation_date:   form.compensation_date || null,
      urgency,
      root_cause_category: form.root_cause_category,
      root_cause_detail:   form.root_cause_detail || null,
      corrective_action:   form.corrective_action,
      gl_entry_ref:        form.gl_entry_ref || null,
      client_informed:     form.client_informed,
      client_informed_date: form.client_informed_date || null,
      ngx_report_required: ngxRequired,
      ngx_report_filed:    form.ngx_report_filed,
      ngx_report_date:     form.ngx_report_date || null,
      status:              'open',
      logged_by:           currentUser || 'Operations',
      notes:               form.notes || null,
    }

    const { data, error } = await supabase
      .from('f06_error_trades')
      .insert(payload)
      .select()
      .single()

    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }

    setEntries(prev => [data, ...prev])
    setSelected(data)
    setView('detail')
    setForm(EMPTY)
    loadWeekly()
  }

  async function signOff(id) {
    const { data } = await supabase
      .from('f06_error_trades')
      .update({ co_signoff: currentUser, co_signoff_at: new Date().toISOString(), status: 'closed' })
      .eq('id', id)
      .select().single()
    if (data) {
      setEntries(prev => prev.map(e => e.id === id ? data : e))
      setSelected(data)
    }
  }

  async function markNGXFiled(id) {
    const { data } = await supabase
      .from('f06_error_trades')
      .update({ ngx_report_filed: true, ngx_report_date: today() })
      .eq('id', id)
      .select().single()
    if (data) {
      setEntries(prev => prev.map(e => e.id === id ? data : e))
      setSelected(data)
    }
  }

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: NAV, minHeight: '100vh', background: SURFACE }}>

      {/* ── Header ── */}
      <div style={{ background: NAV, borderBottom: `3px solid ${GOLD}`, padding: '20px 32px' }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
          Form F-06 · Trading Controls
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
          Error Trade General Ledger
        </div>
        <div style={{ color: '#8fa3c0', fontSize: 12, marginTop: 2 }}>
          Error logging · Root cause analysis · NGX Rule 12.2(e) threshold monitoring
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: 'calc(100vh - 82px)' }}>

        {/* ── Main Panel ── */}
        <div style={{ padding: 32, borderRight: `1px solid ${BORDER}` }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 0, borderBottom: `1.5px solid ${BORDER}`, marginBottom: 28 }}>
            {[
              { key: 'log',    label: '📋 Error Trade Log' },
              { key: 'detect', label: '🔍 Detect Errors' },
              { key: 'new',    label: '+ Log Manually' },
            ].map(t => (
              <div key={t.key} onClick={() => { setView(t.key); setSelected(null) }}
                style={{
                  padding: '8px 18px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  borderBottom: view === t.key || (view === 'detail' && t.key === 'log') ? `2.5px solid ${GOLD}` : '2.5px solid transparent',
                  color: view === t.key || (view === 'detail' && t.key === 'log') ? NAV : '#6b7280',
                  marginBottom: -2,
                }}>
                {t.label}
              </div>
            ))}
          </div>

          {/* ── LOG VIEW ── */}
          {(view === 'log' && !selected) && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 60, color: '#aaa', fontSize: 14 }}>Loading…</div>
              ) : entries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: NAV, marginBottom: 8 }}>No Error Trades Logged</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24 }}>Every identified error trade must be logged on the same day it is discovered.</div>
                  <button onClick={() => setView('new')} style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '11px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    + Log First Error Trade
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{entries.length} error trade{entries.length !== 1 ? 's' : ''} on record</div>
                    <button onClick={() => setView('new')} style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      + Log New Error
                    </button>
                  </div>
                  <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          {['Ref No', 'Error Date', 'Type', 'Security', 'Client', 'Impact (₦)', 'Urgency', 'Status', ''].map(h => (
                            <th key={h} style={thS}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(e => {
                          const ug = urgencyConfig(e.urgency)
                          const et = ERROR_TYPES.find(t => t.value === e.error_type)
                          return (
                            <tr key={e.id} style={{ borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}
                              onMouseOver={ev => ev.currentTarget.style.background = '#fafafa'}
                              onMouseOut={ev  => ev.currentTarget.style.background = '#fff'}
                              onClick={() => { setSelected(e); setView('detail') }}>
                              <td style={{ ...tdS, fontWeight: 700, color: GOLD, fontFamily: 'monospace' }}>{e.ref_number}</td>
                              <td style={tdS}>{fmtDate(e.error_date)}</td>
                              <td style={{ ...tdS, fontSize: 11 }}>{et?.short || e.error_type}</td>
                              <td style={{ ...tdS, fontWeight: 700, fontFamily: 'monospace' }}>{e.security}</td>
                              <td style={{ ...tdS, fontSize: 11 }}>{e.client_name || e.client_account}</td>
                              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: Number(e.impact_client) < 0 ? RED : GREEN }}>
                                {fmtN(e.impact_client)}
                              </td>
                              <td style={tdS}>
                                <span style={{ background: ug.bg, color: ug.color, border: `1px solid ${ug.border}`, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                                  {e.urgency}
                                </span>
                              </td>
                              <td style={tdS}>
                                <span style={{
                                  background: e.status === 'closed' ? GREEN_BG : e.status === 'under_review' ? AMBER_BG : '#f3f4f6',
                                  color: e.status === 'closed' ? GREEN : e.status === 'under_review' ? AMBER : '#6b7280',
                                  borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 600, textTransform: 'capitalize',
                                }}>
                                  {e.status}
                                </span>
                              </td>
                              <td style={tdS}>
                                {e.ngx_report_required && !e.ngx_report_filed && (
                                  <span style={{ background: RED_BG, color: RED, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>
                                    NGX Pending
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DETAIL VIEW ── */}
          {(view === 'detail' && selected) && (
            <DetailView
              entry={selected}
              onBack={() => { setSelected(null); setView('log') }}
              onPrint={() => printF06(selected)}
              onSignOff={() => signOff(selected.id)}
              onNGXFiled={() => markNGXFiled(selected.id)}
              currentUser={currentUser}
            />
          )}

          {/* ── DETECT VIEW ── */}
          {view === 'detect' && (
            <F06DetectionModule
              onPreFillF06={prefill => {
                setForm(f => ({ ...f, ...prefill }))
                setView('new')
              }}
            />
          )}

          {/* ── NEW ENTRY FORM ── */}
          {view === 'new' && (
            <NewEntryForm
              form={form} setField={setField} errors={errors}
              urgency={urgency} urgCfg={urgCfg}
              saving={saving} onSave={saveEntry}
              onCancel={() => { setView('log'); setForm(EMPTY); setErrors({}) }}
            />
          )}
        </div>

        {/* ── Sidebar ── */}
        <div style={{ background: '#fff', padding: 24, overflowY: 'auto' }}>

          {/* Weekly NGX threshold tracker */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              NGX Threshold — This Week
            </div>
            {weeklyStats && (
              <div style={{
                background: weeklyStats.triggered ? RED_BG : weeklyStats.total >= 400000 ? AMBER_BG : GREEN_BG,
                border: `1.5px solid ${weeklyStats.triggered ? '#fca5a5' : weeklyStats.total >= 400000 ? '#ffe082' : '#a5d6a7'}`,
                borderRadius: 10, padding: 16,
              }}>
                <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: weeklyStats.triggered ? RED : weeklyStats.total >= 400000 ? AMBER : GREEN }}>
                  {fmtN(weeklyStats.total)}
                </div>
                <div style={{ fontSize: 11, color: '#5a6a82', marginTop: 3, marginBottom: 10 }}>
                  Aggregate impact · {weeklyStats.count} error{weeklyStats.count !== 1 ? 's' : ''} · w/c {fmtDate(weeklyStats.weekStart)}
                </div>
                {weeklyStats.triggered ? (
                  <div style={{ fontSize: 12, fontWeight: 700, color: RED }}>
                    🔴 ₦500,000 threshold exceeded — NGX report required
                  </div>
                ) : weeklyStats.total >= 400000 ? (
                  <div style={{ fontSize: 12, color: AMBER, fontWeight: 600 }}>
                    ⚠️ Approaching ₦500,000 threshold
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: GREEN }}>
                    ✅ Below ₦500,000 aggregate threshold
                  </div>
                )}
                <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.6)', borderRadius: 6, padding: '6px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#6b7280' }}>Weekly limit:</span>
                    <span style={{ fontWeight: 700 }}>₦500,000</span>
                  </div>
                  <div style={{ marginTop: 4, background: '#e5e7eb', borderRadius: 4, height: 6 }}>
                    <div style={{ width: Math.min(100, (weeklyStats.total / 500000) * 100) + '%', height: '100%', borderRadius: 4, background: weeklyStats.triggered ? RED : weeklyStats.total >= 400000 ? AMBER : GREEN, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Urgency quick reference */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Urgency Reference
            </div>
            {[
              { level: 'CRITICAL', range: '≥ ₦500,000', action: 'Compliance Officer + MD within 1 hour. Board if > ₦2M. NGX report within 2 working days.' },
              { level: 'HIGH',     range: '₦50k – ₦499,999', action: 'Head of Operations immediately. Compliance within 2 hours. NGX report required.' },
              { level: 'STANDARD', range: '< ₦50,000', action: 'Head of Operations manages. Compliance within 48 hours. No NGX report unless weekly aggregate triggered.' },
            ].map(u => {
              const cfg = urgencyConfig(u.level)
              return (
                <div key={u.level} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{u.level}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{u.range}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', lineHeight: 1.5 }}>{u.action}</div>
                </div>
              )
            })}
          </div>

          {/* Recent entries */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              Recent Entries
            </div>
            {entries.slice(0, 8).map(e => {
              const ug = urgencyConfig(e.urgency)
              return (
                <div key={e.id}
                  onClick={() => { setSelected(e); setView('detail') }}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseOver={ev => ev.currentTarget.style.borderColor = GOLD}
                  onMouseOut={ev  => ev.currentTarget.style.borderColor = BORDER}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: GOLD, fontFamily: 'monospace' }}>{e.ref_number}</span>
                    <span style={{ background: ug.bg, color: ug.color, fontSize: 9, fontWeight: 700, padding: '1px 7px', borderRadius: 20 }}>{e.urgency}</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: NAV }}>{e.security} · {e.client_name || e.client_account}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{fmtDate(e.error_date)} · {fmtN(e.impact_client)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NEW ENTRY FORM ────────────────────────────────────────────────────────────
function NewEntryForm({ form, setField, errors, urgency, urgCfg, saving, onSave, onCancel }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV }}>Log New Error Trade</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>All fields marked * are required. Log on the same day the error is discovered.</div>
        </div>
        {/* Live urgency indicator */}
        {form.impact_client !== '' && (
          <div style={{ background: urgCfg.bg, border: `1.5px solid ${urgCfg.border}`, borderRadius: 8, padding: '8px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: urgCfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>Urgency</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: urgCfg.color }}>{urgency}</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 20 }}>

        {/* Section 1: Identification */}
        <SectionHead n="1" title="Error Identification" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Error Type *" error={errors.error_type}>
            <select style={inp} value={form.error_type} onChange={e => setField('error_type', e.target.value)}>
              <option value="">— Select error type —</option>
              {ERROR_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Security / Instrument *" error={errors.security}>
            <input style={inp} placeholder="e.g. ACCESSCORP, DANGCEM" value={form.security} onChange={e => setField('security', e.target.value)} />
          </Field>
          <Field label="Date of Error (Trade Date) *" error={errors.error_date}>
            <input style={inp} type="date" value={form.error_date} onChange={e => setField('error_date', e.target.value)} />
          </Field>
          <Field label="Date Discovered *" error={errors.discovery_date}>
            <input style={inp} type="date" value={form.discovery_date} onChange={e => setField('discovery_date', e.target.value)} />
          </Field>
          <Field label="Client Account Number *" error={errors.client_account}>
            <input style={inp} placeholder="e.g. TW-0145" value={form.client_account} onChange={e => setField('client_account', e.target.value)} />
          </Field>
          <Field label="Client Name">
            <input style={inp} placeholder="Full client name" value={form.client_name} onChange={e => setField('client_name', e.target.value)} />
          </Field>
          <Field label="CSCS Number">
            <input style={inp} placeholder="CSCS account number" value={form.cscs_no} onChange={e => setField('cscs_no', e.target.value)} />
          </Field>
        </div>
        <Field label="Error Description — What Was Instructed vs. What Was Executed *" error={errors.error_description}>
          <textarea style={{ ...inp, minHeight: 90, resize: 'vertical' }}
            placeholder="Be specific: 'Client instructed SELL 5,000 AIRTELAFRI. Order was entered twice — 10,000 units executed. Duplicate entry by Dealing Clerk at 10:32 AM.'"
            value={form.error_description} onChange={e => setField('error_description', e.target.value)} />
        </Field>

        {/* Section 2: Financial Impact */}
        <SectionHead n="2" title="Financial Impact & GL Account" />
        {form.impact_client !== '' && (
          <div style={{ background: urgCfg.bg, border: `1.5px solid ${urgCfg.border}`, borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: urgCfg.color, marginBottom: 3 }}>
              {urgency} — {urgCfg.desc}
            </div>
            {urgency !== 'STANDARD' && (
              <div style={{ fontSize: 12, color: '#374151' }}>
                {urgency === 'CRITICAL'
                  ? '⚡ Notify Compliance Officer and MD within 1 hour. NGX report required within 2 working days.'
                  : '⚠️ Notify Head of Operations immediately. Compliance within 2 hours. MD same day. NGX report required.'}
              </div>
            )}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <Field label="Financial Impact to Client (₦) * — negative = loss to client" error={errors.impact_client}>
            <input style={inp} type="number" placeholder="e.g. -75000 or +50000"
              value={form.impact_client} onChange={e => setField('impact_client', e.target.value)} />
          </Field>
          <Field label="Financial Impact to Firm — net (₦)">
            <input style={inp} type="number" placeholder="After compensation"
              value={form.impact_firm} onChange={e => setField('impact_firm', e.target.value)} />
          </Field>
          <Field label="Compensation Paid to Client (₦)">
            <input style={inp} type="number" placeholder="0" value={form.compensation_paid} onChange={e => setField('compensation_paid', e.target.value)} />
          </Field>
          <Field label="Compensation Date">
            <input style={inp} type="date" value={form.compensation_date} onChange={e => setField('compensation_date', e.target.value)} />
          </Field>
          <Field label="GL Account Entry Reference">
            <input style={inp} placeholder="Finance GL ref once entered" value={form.gl_entry_ref} onChange={e => setField('gl_entry_ref', e.target.value)} />
          </Field>
        </div>

        {/* Section 3: Root Cause */}
        <SectionHead n="3" title="Root Cause Analysis" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Root Cause Category *" error={errors.root_cause_category}>
            <select style={inp} value={form.root_cause_category} onChange={e => setField('root_cause_category', e.target.value)}>
              <option value="">— Select category —</option>
              {ROOT_CAUSES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Root Cause Detail">
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }}
            placeholder="Specific underlying cause — what went wrong and why"
            value={form.root_cause_detail} onChange={e => setField('root_cause_detail', e.target.value)} />
        </Field>

        {/* Section 4: Corrective Action */}
        <SectionHead n="4" title="Corrective Action" />
        <Field label="Corrective Action Taken *" error={errors.corrective_action}>
          <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' }}
            placeholder="What was done to fix this: reversal, rebooking, market unwind, compensation, etc."
            value={form.corrective_action} onChange={e => setField('corrective_action', e.target.value)} />
        </Field>

        {/* Section 5: Client & Regulatory */}
        <SectionHead n="5" title="Client Communication & Regulatory Obligations" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Client Informed?">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
              <input type="checkbox" checked={form.client_informed} onChange={e => setField('client_informed', e.target.checked)} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: 13 }}>Client has been informed of this error</span>
            </div>
          </Field>
          {form.client_informed && (
            <Field label="Date Client Informed">
              <input style={inp} type="date" value={form.client_informed_date} onChange={e => setField('client_informed_date', e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Additional Notes">
          <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }}
            placeholder="Any additional context, follow-up actions, or linked F-04/F-05 session reference"
            value={form.notes} onChange={e => setField('notes', e.target.value)} />
        </Field>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onCancel} disabled={saving}
            style={{ background: 'transparent', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '10px 22px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button onClick={onSave} disabled={saving}
            style={{ background: saving ? '#aaa' : GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '⏳ Saving…' : '✓ Log Error Trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── DETAIL VIEW ───────────────────────────────────────────────────────────────
function DetailView({ entry, onBack, onPrint, onSignOff, onNGXFiled, currentUser }) {
  const ug  = urgencyConfig(entry.urgency)
  const et  = ERROR_TYPES.find(t => t.value === entry.error_type)
  const rc  = ROOT_CAUSES.find(r => r.value === entry.root_cause_category)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 12, marginBottom: 8, padding: 0 }}>
            ← Back to Log
          </button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: NAV }}>{entry.ref_number}</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Logged by {entry.logged_by} · {new Date(entry.logged_at).toLocaleString('en-GB')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ background: ug.bg, color: ug.color, border: `1.5px solid ${ug.border}`, borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700 }}>
            {entry.urgency}
          </span>
          <button onClick={onPrint}
            style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '7px 16px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            🖨 Print / PDF
          </button>
        </div>
      </div>

      {/* Alert banners */}
      {entry.ngx_report_required && !entry.ngx_report_filed && (
        <div style={{ background: RED_BG, border: `1.5px solid #fca5a5`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, color: RED, fontSize: 13 }}>🔴 NGX Report Required — Rule 12.2(e)</div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
              {entry.urgency === 'CRITICAL' ? 'File within 2 working days of identification.' : 'File within 5 working days of end of the relevant calendar week.'}
            </div>
          </div>
          <button onClick={onNGXFiled}
            style={{ background: RED, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>
            Mark as Filed
          </button>
        </div>
      )}
      {entry.ngx_report_required && entry.ngx_report_filed && (
        <div style={{ background: GREEN_BG, border: `1.5px solid #a5d6a7`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>✅ NGX Report Filed — {fmtDate(entry.ngx_report_date)}</div>
        </div>
      )}

      {/* Detail grid */}
      {[
        { title: '1. Error Identification', rows: [
          ['Error Reference', entry.ref_number, 'Error Type', et?.label || entry.error_type],
          ['Security', entry.security, 'Date of Error', fmtDate(entry.error_date)],
          ['Date Discovered', fmtDate(entry.discovery_date), 'Client Account', entry.client_account],
          ['Client Name', entry.client_name || '—', 'CSCS No', entry.cscs_no || '—'],
        ]},
        { title: '2. Financial Impact', rows: [
          ['Impact to Client', <span style={{ fontWeight: 700, color: Number(entry.impact_client) < 0 ? RED : GREEN }}>{fmtN(entry.impact_client)}</span>, 'Impact to Firm', fmtN(entry.impact_firm)],
          ['Compensation Paid', fmtN(entry.compensation_paid), 'Compensation Date', fmtDate(entry.compensation_date)],
          ['GL Entry Reference', entry.gl_entry_ref || '— Pending —', '', ''],
        ]},
        { title: '3. Root Cause', rows: [
          ['Root Cause Category', rc?.label || entry.root_cause_category, '', ''],
        ]},
      ].map(section => (
        <div key={section.title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: NAV, textTransform: 'uppercase', letterSpacing: 1, borderBottom: `2px solid ${NAV}`, paddingBottom: 3, marginBottom: 10 }}>
            {section.title}
          </div>
          {section.rows.map((row, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 0, marginBottom: 8 }}>
              {row.map((cell, j) => (
                <div key={j} style={{ padding: '5px 0', borderBottom: `1px solid ${BORDER}`, paddingRight: 16 }}>
                  {j % 2 === 0 ? (
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{cell}</div>
                  ) : (
                    <div style={{ fontSize: 13, color: NAV, marginTop: 1 }}>{cell}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {/* Long text fields */}
      {[
        { label: 'Error Description', value: entry.error_description },
        { label: 'Root Cause Detail', value: entry.root_cause_detail },
        { label: 'Corrective Action Taken', value: entry.corrective_action },
        entry.notes && { label: 'Additional Notes', value: entry.notes },
      ].filter(Boolean).map(f => (
        <div key={f.label} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{f.label}</div>
          <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px', fontSize: 13, lineHeight: 1.7 }}>{f.value || '—'}</div>
        </div>
      ))}

      {/* Client & NGX status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: entry.client_informed ? GREEN_BG : AMBER_BG, border: `1px solid ${entry.client_informed ? '#a5d6a7' : '#ffe082'}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: entry.client_informed ? GREEN : AMBER }}>
            {entry.client_informed ? '✅ Client Informed' : '⏳ Client Not Yet Informed'}
          </div>
          {entry.client_informed && <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{fmtDate(entry.client_informed_date)}</div>}
        </div>
        <div style={{ background: entry.ngx_report_required ? (entry.ngx_report_filed ? GREEN_BG : RED_BG) : '#f3f4f6', border: `1px solid ${entry.ngx_report_required ? (entry.ngx_report_filed ? '#a5d6a7' : '#fca5a5') : '#e5e7eb'}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: entry.ngx_report_required ? (entry.ngx_report_filed ? GREEN : RED) : '#6b7280' }}>
            {entry.ngx_report_required ? (entry.ngx_report_filed ? '✅ NGX Report Filed' : '🔴 NGX Report Pending') : '✅ No NGX Report Required'}
          </div>
          {entry.ngx_report_filed && <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{fmtDate(entry.ngx_report_date)}</div>}
        </div>
      </div>

      {/* CO Sign-off */}
      {!entry.co_signoff ? (
        <div style={{ background: '#f0f4ff', border: `1.5px solid #c7d2fe`, borderRadius: 10, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: BLUE }}>Compliance Officer Sign-off Required</div>
            <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Review the entry and confirm it is complete and accurately managed.</div>
          </div>
          <button onClick={onSignOff}
            style={{ background: BLUE, color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0, marginLeft: 16 }}>
            Sign Off &amp; Close
          </button>
        </div>
      ) : (
        <div style={{ background: GREEN_BG, border: `1.5px solid #a5d6a7`, borderRadius: 10, padding: 14 }}>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 13 }}>✅ Closed — Signed off by {entry.co_signoff}</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{new Date(entry.co_signoff_at).toLocaleString('en-GB')}</div>
        </div>
      )}
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────
function SectionHead({ n, title }) {
  return (
    <div style={{ borderBottom: `2px solid ${NAV}`, paddingBottom: 4, marginBottom: -4 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: GOLD, marginRight: 8 }}>{n}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: NAV, textTransform: 'uppercase', letterSpacing: 1 }}>{title}</span>
    </div>
  )
}

function Field({ label, children, error }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
      {error && <div style={{ fontSize: 11, color: RED, marginTop: 3 }}>{error}</div>}
    </div>
  )
}
