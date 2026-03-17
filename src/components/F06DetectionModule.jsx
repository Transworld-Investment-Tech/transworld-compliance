import { useState } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const NAV      = '#0d1f3c'
const GOLD     = '#c9a84c'
const GREEN    = '#1a7a4a'
const GREEN_BG = '#e8f5e9'
const AMBER    = '#b45309'
const AMBER_BG = '#fff8e1'
const RED      = '#c0392b'
const RED_BG   = '#fdecea'
const BLUE     = '#1565c0'
const BLUE_BG  = '#e3f0ff'
const BORDER   = '#dde1ea'
const SURFACE  = '#f7f8fa'

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d), safe = s.length === 10 ? s + 'T12:00:00' : s
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtN(v) { return (v == null || v === '') ? '—' : Number(v).toLocaleString() }
function fmtNGN(v) {
  if (!v || Number(v) === 0) return '— (upload CSD for auto-calculation)'
  return '₦' + Number(v).toLocaleString('en-NG', { minimumFractionDigits: 2 })
}
function today() { return new Date().toISOString().split('T')[0] }

async function parseCSD(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const hdrs = (raw[1] || []).map(h => h ? String(h).trim() : null)
        const rows = raw.slice(2).filter(r => r.some(c => c !== null)).map(r => {
          const obj = {}; hdrs.forEach((h, i) => { if (h) obj[h] = r[i] }); return obj
        })
        const csdMap = {}
        for (const t of rows) {
          if (!t.CSCSAccNum || !t.SecurityCode) continue
          const rawDate = String(t.TranDate || '').replace(/Reverse$/i, '').trim()
          let date = rawDate
          if (/^\d{2}\/\d{2}\/\d{4}/.test(rawDate)) {
            const [dd, mm, yyyy] = rawDate.split('/'); date = `${yyyy}-${mm}-${dd}`
          } else date = rawDate.slice(0, 10)
          const key = `${t.CSCSAccNum}|${t.SecurityCode}|${date}`
          if (!csdMap[key]) csdMap[key] = []
          csdMap[key].push({
            price: Number(t.Price) || 0,
            consideration: Number(String(t.Consideration || '').replace(/,/g, '')) || 0,
            units: Number(t.Units) || 0,
            side: t.Side,
          })
        }
        resolve(csdMap)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

function classifyUrgency(impact) {
  const abs = Math.abs(Number(impact) || 0)
  if (abs >= 500000) return 'CRITICAL'
  if (abs >= 50000)  return 'HIGH'
  return 'HIGH'
}
function urgCfg(level) {
  if (level === 'CRITICAL') return { color: RED,   bg: RED_BG,   border: '#fca5a5', icon: '🔴' }
  if (level === 'HIGH')     return { color: AMBER, bg: AMBER_BG, border: '#ffe082', icon: '⚠️' }
  return                            { color: GREEN, bg: GREEN_BG, border: '#a5d6a7', icon: '🟢' }
}
const ruleLabels = {
  duplicate:    { label: 'Type 4 — Duplicate Trade',      icon: '🔁', color: RED   },
  partial_open: { label: 'Type 5 — Partial / Omitted',    icon: '⚠️', color: AMBER },
  no_mandate:   { label: 'Type 7 — No Mandate on File',   icon: '❓', color: BLUE  },
}

function runDetection({ f04Lines, f05Lines, csdMap }) {
  const findings = []; let id = 0
  const executed  = f05Lines.filter(l => l.section_type === 'fully_executed')
  const partial   = f05Lines.filter(l => l.section_type === 'partial')
  const notJobbed = f05Lines.filter(l => l.section_type === 'not_jobbed')

  const execMap = {}
  for (const e of executed) {
    const key = `${e.cscs_acc_num}|${e.security}|${e.effective_date}`
    if (!execMap[key]) execMap[key] = []; execMap[key].push(e)
  }
  const f04StockMap = {}
  for (const l of f04Lines) {
    const k = `${l.cscs_no}|${l.symbol}`
    if (!f04StockMap[k]) f04StockMap[k] = []; f04StockMap[k].push(l)
  }

  // Rule 1 — Duplicate
  for (const ej of notJobbed) {
    const key = `${ej.cscs_acc_num}|${ej.security}|${ej.effective_date}`
    const execs = execMap[key] || []
    for (const ex of execs) {
      if (Number(ex.units) !== Number(ej.units)) continue
      const csdHits = csdMap ? (csdMap[key] || []) : []
      const impact  = csdHits.length >= 2 ? csdHits[0].consideration : 0
      const price   = csdHits[0]?.price || 0
      findings.push({
        id: ++id, rule: 'duplicate', errorType: 'duplicate',
        urgency: classifyUrgency(impact || 50000),
        client: ej.client, cscs: ej.cscs_acc_num,
        security: ej.security, date: ej.effective_date,
        side: ex.order_type, units: Number(ex.units),
        price, impact, hasCSD: csdHits.length > 0,
        description: `${ej.security} ${ex.order_type} ${fmtN(ex.units)} units on ${fmtDate(ej.effective_date)} appears in BOTH Fully Executed (jobbing desk) AND Executed Not Jobbed (e-trade portal). ${csdHits.length >= 2 ? `CSD confirms ${csdHits.length} settlements of the same trade.` : 'Upload CSD Trade Log to confirm duplicate settlement.'}`,
        suggestedDescription: `Client trade executed via both the jobbing desk and the e-trade portal on ${fmtDate(ej.effective_date)}. ${ej.security} ${ex.order_type} ${fmtN(ex.units)} units — both channels executed. Client's position changed by ${fmtN(Number(ex.units) * 2)} units when only ${fmtN(ex.units)} were instructed.`,
        rootCause: 'human_data_entry',
        rootCauseDetail: `Same instruction executed twice — once via the jobbing desk and once via the e-trade portal. Likely cause: client placed a self-directed order on the portal while desk staff also entered it independently.`,
        correctiveAction: `1. Confirm with client which execution was intended. 2. Reverse the duplicate leg. 3. Calculate financial impact and compensate client if position was adversely affected. 4. Notify Compliance Officer within 2 hours. Contact client within 24 hours.`,
      })
      break
    }
  }

  // Rule 2 — Partial not rolled forward
  for (const p of partial) {
    const outstanding = Number(p.units_outstanding) || 0
    if (outstanding <= 0) continue
    const f04Key = `${p.cscs_acc_num}|${p.security}`
    const laterJobs = (f04StockMap[f04Key] || []).filter(l => l.eff_date > p.effective_date)
    const rolled = laterJobs.length > 0
    const csdKey  = `${p.cscs_acc_num}|${p.security}|${p.effective_date}`
    const csdHits = csdMap ? (csdMap[csdKey] || []) : []
    const price   = csdHits[0]?.price || 0
    const impact  = price > 0 ? outstanding * price : 0
    const pct     = p.units_jobbed > 0 ? Math.round((outstanding / p.units_jobbed) * 100) : 0
    findings.push({
      id: ++id, rule: 'partial_open', errorType: 'omitted',
      urgency: rolled ? 'STANDARD' : classifyUrgency(impact || 50000),
      client: p.client, cscs: p.cscs_acc_num,
      security: p.security, date: p.effective_date,
      side: p.order_type, units: Number(p.units_jobbed),
      price, impact, hasCSD: csdHits.length > 0,
      outstanding, traded: Number(p.units_traded), pct, rolled,
      rolledTo: rolled ? laterJobs.map(j => fmtDate(j.eff_date)).join(', ') : null,
      description: `Partial fill: ${fmtN(p.units_jobbed)} jobbed, ${fmtN(p.units_traded)} traded. ${fmtN(outstanding)} units (${pct}%) outstanding. ${rolled ? `✓ Rolled into subsequent mandate(s) on: ${laterJobs.map(j => fmtDate(j.eff_date)).join(', ')}.` : `No follow-up mandate found in F-04 — client instruction may be partially unfulfilled.`}`,
      suggestedDescription: `Client instructed ${p.order_type} ${fmtN(p.units_jobbed)} ${p.security} on ${fmtDate(p.effective_date)}. Only ${fmtN(p.units_traded)} units were executed (${100-pct}% fill). ${fmtN(outstanding)} units remain outstanding${rolled ? ` and were rolled forward to subsequent trading days.` : ` with no roll-forward mandate found.`}`,
      rootCause: rolled ? 'external_factor' : 'process_gap',
      rootCauseDetail: rolled ? `Partial fill due to insufficient market liquidity or price constraint. Outstanding units rolled forward.` : `Partial fill — outstanding units not re-jobbed or communicated to client.`,
      correctiveAction: rolled ? `Confirm rolled mandate was fully executed. Verify client was informed of partial fill status.` : `Re-enter outstanding ${fmtN(outstanding)} units as a new job immediately. Notify client of partial fill. Assess if price movement constitutes client loss.`,
    })
  }

  // Rule 3 — E-trade with no mandate
  for (const e of notJobbed) {
    const dupKey = `${e.cscs_acc_num}|${e.security}|${e.effective_date}`
    if (execMap[dupKey]) continue
    const f04Key = `${e.cscs_acc_num}|${e.security}`
    if (f04StockMap[f04Key]) continue
    const csdKey  = `${e.cscs_acc_num}|${e.security}|${e.effective_date}`
    const csdHits = csdMap ? (csdMap[csdKey] || []) : []
    const price   = csdHits[0]?.price || 0
    const impact  = price > 0 ? (Number(e.units) || 0) * price : 0
    findings.push({
      id: ++id, rule: 'no_mandate', errorType: 'unauthorised',
      urgency: classifyUrgency(impact || 50000),
      client: e.client, cscs: e.cscs_acc_num,
      security: e.security, date: e.effective_date,
      side: e.order_type || 'MIXED', units: Number(e.units) || 0,
      price, impact, hasCSD: csdHits.length > 0,
      description: `Trade executed via e-trade portal with no F-04 mandate on file for ${e.client} — ${e.security} — ${fmtN(e.units)} units on ${fmtDate(e.effective_date)}. No jobbing mandate found in this date's F-04 or any prior F-04. Requires review.`,
      suggestedDescription: `E-trade portal execution with no written mandate on file. ${e.security} ${fmtN(e.units)} units on ${fmtDate(e.effective_date)} for ${e.client}. No corresponding F-04 job order found in system history.`,
      rootCause: 'misread_mandate',
      rootCauseDetail: `No F-04 mandate found for this client/security combination. Either (a) client traded self-directed via portal — may be legitimate, or (b) trade executed without a valid written mandate.`,
      correctiveAction: `Review client communication records for ${fmtDate(e.effective_date)}. If client confirms instruction: document as self-directed and close. If no instruction confirmed: treat as unauthorised trade — notify Compliance Officer immediately.`,
    })
  }
  return findings
}

export default function F06DetectionModule({ onPreFillF06 }) {
  const [selectedDate, setSelectedDate] = useState(today())
  const [f04Sessions,  setF04Sessions]  = useState([])
  const [f05Sessions,  setF05Sessions]  = useState([])
  const [selectedF04,  setSelectedF04]  = useState(null)
  const [selectedF05,  setSelectedF05]  = useState(null)
  const [csdFile,      setCsdFile]      = useState(null)
  const [csdMap,       setCsdMap]       = useState(null)
  const [findings,     setFindings]     = useState([])
  const [dismissed,    setDismissed]    = useState(new Set())
  const [selected,     setSelected]     = useState(null)
  const [stage,        setStage]        = useState('select')
  const [loading,      setLoading]      = useState(false)
  const [loadingDate,  setLoadingDate]  = useState(false)
  const [error,        setError]        = useState('')

  async function loadSessionsForDate(date) {
    if (!date) return
    setLoadingDate(true); setError('')
    setSelectedF04(null); setSelectedF05(null); setF04Sessions([]); setF05Sessions([])
    const [f04Res, f05Res] = await Promise.all([
      supabase.from('f04_mandates').select('id, trade_date, approver_name, line_count, pdf_name, status')
        .eq('trade_date', date).eq('status', 'approved').order('created_at', { ascending: false }),
      supabase.from('reconciliation_sessions').select('id, trade_date, status, approver_name, fully_executed_count, partial_count, not_jobbed_count, unexecuted_count')
        .eq('trade_date', date).eq('status', 'approved').order('created_at', { ascending: false }),
    ])
    const f04 = f04Res.data || []; const f05 = f05Res.data || []
    setF04Sessions(f04); setF05Sessions(f05)
    if (f04.length === 1) setSelectedF04(f04[0])
    if (f05.length === 1) setSelectedF05(f05[0])
    if (f04.length === 0 && f05.length === 0) setError(`No approved F-04 or F-05 sessions found for ${fmtDate(date)}.`)
    setLoadingDate(false)
  }

  async function handleCSDFile(file) {
    setCsdFile(file); setError('')
    try { const map = await parseCSD(file); setCsdMap(map) }
    catch { setError('Could not parse CSD file. Check it is the correct Excel export.') }
  }

  async function runAnalysis() {
    if (!selectedF04 || !selectedF05) { setError('Select both an F-04 and F-05 session.'); return }
    setLoading(true); setError('')
    try {
      const [linesRes, f05LinesRes, allF04Res] = await Promise.all([
        supabase.from('f04_mandate_lines').select('*').eq('mandate_id', selectedF04.id),
        supabase.from('reconciliation_lines').select('*').eq('session_id', selectedF05.id),
        supabase.from('f04_mandate_lines').select('cscs_no, symbol, eff_date').lte('eff_date', selectedDate),
      ])
      const found = runDetection({ f04Lines: allF04Res.data || [], f05Lines: f05LinesRes.data || [], csdMap })
      setFindings(found); setDismissed(new Set()); setSelected(null); setStage('results')
    } catch (err) { setError('Analysis failed: ' + err.message) }
    setLoading(false)
  }

  function reset() {
    setStage('select'); setFindings([]); setDismissed(new Set())
    setSelected(null); setCsdFile(null); setCsdMap(null)
    setSelectedF04(null); setSelectedF05(null); setError('')
  }

  const activeFindings = findings.filter(f => !dismissed.has(f.id))
  const criticals = activeFindings.filter(f => f.urgency === 'CRITICAL')
  const highs     = activeFindings.filter(f => f.urgency === 'HIGH')
  const standards = activeFindings.filter(f => f.urgency === 'STANDARD')

  if (stage === 'select') return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Error Detection — Cross-Reference Analysis</div>
        <div style={{ fontSize: 13, color: '#5a6a82', lineHeight: 1.6 }}>Select a trade date. The system will load the F-04 and F-05 sessions already approved for that day and cross-reference them for anomalies. Optionally upload the CSD Trade Log to calculate financial impacts.</div>
      </div>

      <StepCard n="1" title="Select Trade Date">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input type="date" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ border: `1.5px solid ${BORDER}`, borderRadius: 7, padding: '8px 11px', fontSize: 13, color: NAV, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={() => loadSessionsForDate(selectedDate)}
            style={{ background: NAV, color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
            {loadingDate ? '⏳ Loading…' : 'Load Sessions'}
          </button>
        </div>
      </StepCard>

      {(f04Sessions.length > 0 || f05Sessions.length > 0) && (<>
        <StepCard n="2" title="Select F-04 Mandate Session">
          {f04Sessions.length === 0
            ? <EmptyState icon="📋" msg={`No approved F-04 for ${fmtDate(selectedDate)}`} />
            : f04Sessions.map(s => (
              <SessionPill key={s.id} selected={selectedF04?.id === s.id} onSelect={() => setSelectedF04(s)}
                label={`${s.line_count} mandate lines`} sub={`Approved by ${s.approver_name} · ${s.pdf_name || ''}`}
                icon="📋" color={GREEN} />
            ))
          }
        </StepCard>

        <StepCard n="3" title="Select F-05 Reconciliation Session">
          {f05Sessions.length === 0
            ? <EmptyState icon="⚖️" msg={`No approved F-05 for ${fmtDate(selectedDate)}`} />
            : f05Sessions.map(s => (
              <SessionPill key={s.id} selected={selectedF05?.id === s.id} onSelect={() => setSelectedF05(s)}
                label={`${s.fully_executed_count||0} executed · ${s.partial_count||0} partial · ${s.not_jobbed_count||0} e-trade · ${s.unexecuted_count||0} unexecuted`}
                sub={`Approved by ${s.approver_name || '—'}`}
                icon="⚖️" color={BLUE} />
            ))
          }
        </StepCard>

        <StepCard n="4" title={<>CSD Trade Log <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>(optional — enables auto-calculation of financial impacts)</span></>}>
          <div onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSDFile(f) }}
            onClick={() => document.getElementById('csd-upload-detect').click()}
            style={{ border: `2px dashed ${csdFile ? GREEN : BORDER}`, borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'center', background: csdFile ? GREEN_BG : '#fff' }}>
            {csdFile
              ? <div style={{ color: GREEN, fontWeight: 600, fontSize: 13 }}>✓ {csdFile.name} — prices loaded</div>
              : <div>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Drop CSD Trade Log (.xlsx) here or click to browse</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>Without this, errors are detected but impacts show as "— estimate required"</div>
                </div>
            }
            <input id="csd-upload-detect" type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleCSDFile(e.target.files[0]) }} />
          </div>
        </StepCard>
      </>)}

      {error && <div style={{ background: RED_BG, border: `1px solid #fca5a5`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: RED, marginBottom: 14 }}>{error}</div>}

      {selectedF04 && selectedF05 && (
        <button onClick={runAnalysis} disabled={loading}
          style={{ background: loading ? '#aaa' : GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
          {loading ? '⏳ Running analysis…' : '🔍 Run Error Detection'}
        </button>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>Detection Results — {fmtDate(selectedDate)}</div>
          <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>📋 F-04: {selectedF04?.line_count} lines</span>
            <span>⚖️ F-05: {(selectedF05?.fully_executed_count||0)+(selectedF05?.not_jobbed_count||0)+(selectedF05?.partial_count||0)} lines</span>
            {csdFile ? <span style={{ color: GREEN }}>✓ CSD prices loaded</span> : <span style={{ color: AMBER }}>⚠ No CSD</span>}
          </div>
        </div>
        <button onClick={reset} style={{ background: 'transparent', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>← New Analysis</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[{ label: 'Total', v: activeFindings.length, color: NAV }, { label: 'Critical', v: criticals.length, color: RED }, { label: 'High', v: highs.length, color: AMBER }, { label: 'Standard', v: standards.length, color: GREEN }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {!csdFile && (
        <div style={{ background: AMBER_BG, border: `1px solid #ffe082`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: AMBER }}>
          <strong>⚠ No CSD loaded.</strong> Financial impacts show as "— estimate required".{' '}
          <label htmlFor="csd-results" style={{ cursor: 'pointer', textDecoration: 'underline' }}>Upload CSD now</label>
          <input id="csd-results" type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleCSDFile(e.target.files[0]) }} />
        </div>
      )}

      {activeFindings.length === 0 ? (
        <div style={{ background: GREEN_BG, border: `1.5px solid #a5d6a7`, borderRadius: 10, padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 15 }}>No error candidates detected</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>F-04 and F-05 data for {fmtDate(selectedDate)} appears consistent.</div>
        </div>
      ) : activeFindings.map(f => {
        const ug = urgCfg(f.urgency), rl = ruleLabels[f.rule], sel = selected?.id === f.id
        return (
          <div key={f.id} style={{ background: '#fff', border: `1.5px solid ${sel ? GOLD : BORDER}`, borderLeft: `5px solid ${ug.color}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden', boxShadow: sel ? '0 4px 16px rgba(201,168,76,0.15)' : 'none' }}>
            <div onClick={() => setSelected(sel ? null : f)} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ background: ug.bg, color: ug.color, border: `1px solid ${ug.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{ug.icon} {f.urgency}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: NAV }}>{f.security}</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>· {f.client}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>· {fmtDate(f.date)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ background: '#f0f0f0', color: rl?.color, borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>{rl?.icon} {rl?.label}</span>
                  <span style={{ fontSize: 12, color: '#374151' }}>{f.side} {fmtN(f.units)} units{f.outstanding ? ` · ${fmtN(f.outstanding)} outstanding (${f.pct}% unfilled)` : ''}</span>
                  {f.rolled && <span style={{ background: GREEN_BG, color: GREEN, borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 600 }}>Rolled forward</span>}
                </div>
                <div style={{ fontSize: 12, color: '#5a6a82', lineHeight: 1.6 }}>{f.description}</div>
                <div style={{ marginTop: 5, fontSize: 12, fontWeight: 600, color: f.impact > 0 ? ug.color : '#9ca3af' }}>Financial impact: {fmtNGN(f.impact)}</div>
              </div>
              <div style={{ fontSize: 18, color: GOLD, flexShrink: 0 }}>{sel ? '−' : '+'}</div>
            </div>

            {sel && (
              <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px', background: SURFACE }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Pre-filled F-06 data — review before logging</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[
                    { label: 'CSCS Number', value: f.cscs },
                    { label: 'Execution Price', value: f.price > 0 ? `₦${f.price.toLocaleString()}` : '— not available (no CSD)' },
                    { label: 'Root Cause Category', value: f.rootCause.replace(/_/g, ' ') },
                    ...(f.rolledTo ? [{ label: 'Rolled Forward To', value: f.rolledTo }] : []),
                  ].map(d => (
                    <div key={d.label}>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{d.label}</div>
                      <div style={{ fontSize: 12, color: NAV, fontWeight: 500 }}>{d.value}</div>
                    </div>
                  ))}
                </div>
                {[
                  { label: 'Suggested Error Description', value: f.suggestedDescription },
                  { label: 'Root Cause Detail', value: f.rootCauseDetail },
                  { label: 'Suggested Corrective Action', value: f.correctiveAction },
                ].map(d => (
                  <div key={d.label} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{d.label}</div>
                    <div style={{ fontSize: 12, color: '#374151', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', lineHeight: 1.7 }}>{d.value}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button onClick={() => {
                    onPreFillF06({
                      error_date: f.date, discovery_date: today(), error_type: f.errorType,
                      security: f.security, client_account: f.cscs, client_name: f.client, cscs_no: f.cscs,
                      error_description: f.suggestedDescription,
                      impact_client: f.impact > 0 ? String(-Math.abs(f.impact)) : '',
                      impact_firm: '', compensation_paid: '0',
                      root_cause_category: f.rootCause, root_cause_detail: f.rootCauseDetail,
                      corrective_action: f.correctiveAction,
                      notes: `Auto-detected via F-04 × F-05 cross-reference for ${fmtDate(f.date)}.${f.hasCSD ? ' CSD prices confirmed.' : ' CSD not loaded — verify financial impact manually.'}`,
                    })
                  }} style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    → Log as F-06 Error Trade
                  </button>
                  <button onClick={() => { setDismissed(prev => new Set([...prev, f.id])); setSelected(null) }}
                    style={{ background: 'transparent', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
                    Dismiss — Not an Error
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
      {dismissed.size > 0 && (
        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 8 }}>
          {dismissed.size} finding{dismissed.size !== 1 ? 's' : ''} dismissed.{' '}
          <button onClick={() => setDismissed(new Set())} style={{ background: 'none', border: 'none', cursor: 'pointer', color: AMBER, fontSize: 12 }}>Restore all</button>
        </div>
      )}
    </div>
  )
}

function StepCard({ n, title, children }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 20px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 24, height: 24, background: NAV, color: GOLD, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</div>
        <div style={{ fontWeight: 700, fontSize: 13, color: NAV }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function SessionPill({ selected, onSelect, label, sub, icon, color }) {
  return (
    <div onClick={onSelect} style={{ border: `2px solid ${selected ? color : BORDER}`, background: selected ? (color === GREEN ? GREEN_BG : BLUE_BG) : '#fff', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', marginBottom: 6, transition: 'all 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {selected && <span style={{ color, fontSize: 14, fontWeight: 700 }}>✓</span>}
        <span style={{ fontSize: 13 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: selected ? color : NAV }}>{label}</div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{sub}</div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, msg }) {
  return (
    <div style={{ background: SURFACE, border: `1px dashed ${BORDER}`, borderRadius: 8, padding: '14px 18px', textAlign: 'center' }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{msg}</div>
    </div>
  )
}
