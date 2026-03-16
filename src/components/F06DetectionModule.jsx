import { useState, useCallback } from 'react'
import * as XLSX from 'xlsx'

// ── Constants ─────────────────────────────────────────────────────────────────
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

// ── File type detection ───────────────────────────────────────────────────────
function detectFileType(rows, headers) {
  // Job Orders History
  if (headers.includes('RefNo') && headers.includes('JobbedUnits')) return 'job_history'
  // CSD Trade Log
  if (headers.includes('TranDate') && headers.includes('Consideration')) return 'csd_log'
  // Jobbing utilization variants
  const orderTypes = new Set(rows.map(r => r.OrderType).filter(Boolean))
  const hasPartial  = headers.includes('UnitsJobbed')
  const hasMixed    = orderTypes.has('MIXED')
  const colCount    = headers.filter(Boolean).length
  if (hasPartial)                 return 'partial'
  if (colCount === 6 && hasMixed) return 'not_jobbed'
  if (colCount === 6)             return 'fully_executed'
  return 'unknown'
}

function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' })
        const ws  = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        // Try row 2 as headers (NaYa format) else row 1
        let headers = (raw[1] || []).map(h => h ? String(h).trim() : null)
        let dataStart = 2
        if (!headers.some(Boolean) || headers.filter(Boolean).length < 3) {
          headers   = (raw[0] || []).map(h => h ? String(h).trim() : null)
          dataStart = 1
        }
        const dataRows = raw.slice(dataStart).filter(row => row.some(c => c !== null))
        const rows = dataRows.map(row => {
          const obj = {}
          headers.forEach((h, i) => { if (h) obj[h] = row[i] })
          return obj
        })
        const type = detectFileType(rows, headers)
        resolve({ type, headers, rows, fileName: file.name })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── PDF extraction via /api/extract ─────────────────────────────────────────
async function extractJobHistoryFromPDF(file) {
  const base64 = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result.split(',')[1])
    r.onerror = () => rej(new Error('Read failed'))
    r.readAsDataURL(file)
  })

  const systemPrompt = `You are a data extraction assistant for a Nigerian investment securities firm.
You will be given a Job Orders History PDF from NaYa TRM (Transworld Investment and Securities).
Extract ALL rows from the job orders table and return ONLY a JSON array with no preamble, no markdown backticks.

Each object in the array must have exactly these fields:
{
  "RefNo": number,
  "EffectiveDate": "DD/MM/YYYY",
  "ExpiryDate": "DD/MM/YYYY",
  "Client": "string",
  "CSCSNo": "string",
  "Stock": "string (NGX ticker, uppercase)",
  "ExecOrder": "BUY or SELL",
  "Status": "string",
  "JobbedUnits": number,
  "AvailableUnits": number,
  "EnteredBy": "string",
  "ApprovedBy": "string"
}

Rules:
- ExecOrder must be exactly "BUY" or "SELL"
- All numbers must be plain numbers with no commas
- If a field is blank or n/a, use null
- Return ONLY the JSON array, nothing else`

  const response = await fetch('/api/extract', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system:     systemPrompt,
      messages: [{
        role:    'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text',     text: 'Extract all job order rows from this PDF. Return only the JSON array.' }
        ]
      }]
    })
  })

  const data     = await response.json()
  const rawText  = data.content.filter(b => b.type === 'text').map(b => b.text).join('')
  const clean    = rawText.replace(/```json|```/g, '').trim()
  const rows     = JSON.parse(clean)

  // Normalise to match detectFileType expectations
  return {
    type:     'job_history',
    headers:  ['RefNo', 'EffectiveDate', 'ExpiryDate', 'Client', 'CSCSNo', 'Stock', 'ExecOrder', 'Status', 'JobbedUnits', 'AvailableUnits', 'EnteredBy', 'ApprovedBy'],
    rows:     rows.map(r => ({
      RefNo:          r.RefNo,
      EffectiveDate:  r.EffectiveDate,
      ExpiryDate:     r.ExpiryDate,
      Client:         r.Client,
      CSCSNo:         String(r.CSCSNo || ''),
      Stock:          r.Stock,
      ExecOrder:      r.ExecOrder,
      Status:         r.Status,
      JobbedUnits:    Number(r.JobbedUnits) || 0,
      AvailableUnits: Number(r.AvailableUnits) || 0,
      EnteredBy:      r.EnteredBy,
      ApprovedBy:     r.ApprovedBy,
    })),
    fileName: file.name,
  }
}

function fmtDate(d) {
  if (!d) return '—'
  const s = String(d)
  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const safe = s.length === 10 ? s + 'T12:00:00' : s
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function normDate(d) {
  if (!d) return ''
  const s = String(d)
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) {
    const [dd, mm, yyyy] = s.split('/')
    return `${yyyy}-${mm}-${dd}`
  }
  return s.slice(0, 10)
}

function fmtN(v) {
  if (v == null || v === '') return '—'
  const n = Number(String(v).replace(/,/g, ''))
  if (isNaN(n)) return String(v)
  return n.toLocaleString()
}

function fmtNGN(v) {
  if (v == null || v === '') return '— (estimate required)'
  const n = Number(v)
  if (isNaN(n) || n === 0) return '— (estimate required)'
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2 })
}

// ── Detection engine ──────────────────────────────────────────────────────────
function runDetection(parsedFiles) {
  const jobHistory   = parsedFiles.filter(f => f.type === 'job_history').flatMap(f => f.rows)
  const fullyExec    = parsedFiles.filter(f => f.type === 'fully_executed').flatMap(f => f.rows)
  const partialFills = parsedFiles.filter(f => f.type === 'partial').flatMap(f => f.rows)
  const notJobbed    = parsedFiles.filter(f => f.type === 'not_jobbed').flatMap(f => f.rows)
  const csdLog       = parsedFiles.filter(f => f.type === 'csd_log').flatMap(f => f.rows)

  const findings = []
  let id = 0

  // ── Build lookup maps ───────────────────────────────────────────────────────
  // CSD: (cscs, stock, date) → {price, consideration, units, side}
  const csdMap = {}
  for (const t of csdLog) {
    const date = normDate(String(t.TranDate || '').replace(/Reverse$/i, '').trim())
    const key  = `${t.CSCSAccNum}|${t.SecurityCode}|${date}`
    if (!csdMap[key]) csdMap[key] = []
    csdMap[key].push({
      price:         Number(t.Price) || 0,
      consideration: Number(String(t.Consideration || '').replace(/,/g, '')) || 0,
      units:         Number(t.Units) || 0,
      side:          t.Side,
    })
  }

  // Executed lookup: (cscs, stock, date) → row
  const execMap = {}
  for (const e of fullyExec) {
    const date = normDate(e.EffectiveDate)
    const key  = `${e.CSCSAccNum}|${e.Security}|${date}`
    if (!execMap[key]) execMap[key] = []
    execMap[key].push(e)
  }

  // Job history lookup: (cscs, stock) → [jobs]
  const jobStockMap = {}
  const jobRefMap   = {}
  for (const j of jobHistory) {
    const k = `${j.CSCSNo}|${j.Stock}`
    if (!jobStockMap[k]) jobStockMap[k] = []
    jobStockMap[k].push(j)
    jobRefMap[j.RefNo] = j
  }

  // ── RULE 1: Duplicate — same trade in both Executed AND E-Trade ─────────────
  for (const ej of notJobbed) {
    const date   = normDate(ej.EffectiveDate)
    const key    = `${ej.CSCSAccNum}|${ej.Security}|${date}`
    const execs  = execMap[key] || []

    for (const ex of execs) {
      if (Number(ex.Units) === Number(ej.Units)) {
        // Get financial impact from CSD if available
        const csdHits  = csdMap[key] || []
        const dupCount = csdHits.length
        let impact = 0
        let price  = 0
        if (csdHits.length >= 2) {
          price  = csdHits[0].price
          impact = csdHits[0].consideration  // one duplicate leg's value
        } else if (csdHits.length === 1) {
          price  = csdHits[0].price
          impact = csdHits[0].consideration
        }

        findings.push({
          id: ++id,
          rule:         'duplicate',
          errorType:    'duplicate',
          urgency:      impact >= 500000 ? 'CRITICAL' : impact >= 50000 ? 'HIGH' : impact > 0 ? 'HIGH' : 'HIGH',
          client:       ej.Client || ex.Client,
          cscs:         String(ej.CSCSAccNum),
          security:     ej.Security,
          date,
          side:         ex.OrderType,
          units:        Number(ex.Units),
          price,
          impact,
          hasCSD:       csdHits.length > 0,
          settled:      dupCount >= 2,
          description:
            `Client trade appears in BOTH Fully Executed (jobbed channel) AND ` +
            `Executed Not Jobbed (e-trade portal) on ${fmtDate(date)}. ` +
            `${ej.Security} ${ex.OrderType} ${fmtN(ex.Units)} units. ` +
            (csdHits.length >= 2
              ? `CSD Trade Log confirms ${dupCount} settlements of the same trade. Duplicate execution. Financial impact: ₦${impact.toLocaleString()}.`
              : `CSD not uploaded — financial impact requires verification. Both channels show ${fmtN(ex.Units)} units.`),
          suggestedDescription:
            `Client instructed ${ex.OrderType} ${fmtN(ex.Units)} ${ej.Security}. ` +
            `Trade was entered via both the jobbing desk (Ref: jobbing channel) and the e-trade portal (self-directed) on ${fmtDate(date)}. ` +
            `Both executions went through. Client sold/bought ${fmtN(ex.Units * 2)} units when only ${fmtN(ex.Units)} were instructed.`,
          rootCause: 'human_data_entry',
          rootCauseDetail:
            `Same instruction entered twice — once through the jobbing book and once through the e-trade portal. ` +
            `Possible cause: client placed order on e-trade portal and desk staff also entered it independently without checking portal activity.`,
          correctiveAction:
            `Reverse duplicate execution. Rebook correct position. ` +
            `Calculate financial impact to client and compensate if adverse. ` +
            `Review and close one of the two execution records. ` +
            `Contact client within 24 hours.`,
          jobRef:  null,
          channel: 'Both jobbing desk and e-trade portal',
        })
        break
      }
    }
  }

  // ── RULE 2: Partial fill not rolled forward (potential omission) ────────────
  for (const p of partialFills) {
    const outstanding = Number(p.UnitsOutstanding) || 0
    if (outstanding <= 0) continue

    const date    = normDate(p.EffectiveDate)
    const dateObj = new Date(date + 'T12:00:00')
    dateObj.setDate(dateObj.getDate() + 1)
    const nextDay = dateObj.toISOString().split('T')[0]

    // Check if outstanding was rolled into a new job on any subsequent day
    const jobKey  = `${p.CSCSAccNum}|${p.Security}`
    const relJobs = (jobStockMap[jobKey] || []).filter(j => j.eff_date > date)
    const rolled  = relJobs.length > 0

    // Get price from CSD if available
    const csdKey  = `${p.CSCSAccNum}|${p.Security}|${date}`
    const csdHits = csdMap[csdKey] || []
    const price   = csdHits.length > 0 ? csdHits[0].price : 0
    const impact  = price > 0 ? outstanding * price : 0

    findings.push({
      id: ++id,
      rule:         'partial_open',
      errorType:    'omitted',
      urgency:      rolled ? 'STANDARD' : (impact >= 50000 ? 'HIGH' : 'STANDARD'),
      client:       p.Client,
      cscs:         String(p.CSCSAccNum),
      security:     p.Security,
      date,
      side:         p.OrderType,
      units:        Number(p.UnitsJobbed),
      price,
      impact,
      hasCSD:       csdHits.length > 0,
      outstanding,
      traded:       Number(p.UnitsTraded),
      rolled,
      rolledJobs:   relJobs,
      description:
        `Partial fill: jobbed ${fmtN(p.UnitsJobbed)} units, only ${fmtN(p.UnitsTraded)} traded. ` +
        `${fmtN(outstanding)} units (${Math.round(outstanding/p.UnitsJobbed*100)}%) remain outstanding. ` +
        (rolled
          ? `Rolled forward into ${relJobs.length} subsequent job(s) — review for correct execution.`
          : `No follow-up job found on subsequent days. Client's mandate may be partially unfulfilled.`),
      suggestedDescription:
        `Client instructed ${p.OrderType} ${fmtN(p.UnitsJobbed)} ${p.Security} on ${fmtDate(date)}. ` +
        `Only ${fmtN(p.UnitsTraded)} units were executed. ${fmtN(outstanding)} units remain outstanding and ` +
        (rolled ? `were rolled to a subsequent trading day.` : `were not rolled forward or re-jobbed.`),
      rootCause: rolled ? 'external_factor' : 'process_gap',
      rootCauseDetail:
        rolled
          ? `Partial fill caused by insufficient market liquidity or price limit not reached on the day. Job rolled forward.`
          : `Partial fill — outstanding units not rolled forward or re-jobbed. Client instruction partially unfulfilled.`,
      correctiveAction:
        rolled
          ? `Confirm outstanding units are covered by subsequent job. Monitor execution of rolled mandate.`
          : `Re-enter outstanding ${fmtN(outstanding)} units as a new job on the next trading day. ` +
            `Notify client of partial fill status. Assess if client suffered a loss due to price movement on unfilled portion.`,
      jobRef:  null,
      channel: 'Jobbing desk (partial fill)',
      severity: rolled ? 'info' : 'warning',
    })
  }

  // ── RULE 3: E-trade with no corresponding F-04 mandate ─────────────────────
  for (const e of notJobbed) {
    const jobKey = `${e.CSCSAccNum}|${e.Security}`
    const hasJob = !!jobStockMap[jobKey]
    if (hasJob) continue  // has a mandate somewhere in history — skip (Rule 1 catches same-day duplicates)

    const date    = normDate(e.EffectiveDate)
    const csdKey  = `${e.CSCSAccNum}|${e.Security}|${date}`
    const csdHits = csdMap[csdKey] || []
    const price   = csdHits.length > 0 ? csdHits[0].price : 0
    const impact  = price > 0 ? (Number(e.Units) || 0) * price : 0

    findings.push({
      id: ++id,
      rule:      'no_mandate',
      errorType: 'unauthorised',
      urgency:   impact >= 500000 ? 'CRITICAL' : impact >= 50000 ? 'HIGH' : 'STANDARD',
      client:    e.Client,
      cscs:      String(e.CSCSAccNum),
      security:  e.Security,
      date,
      side:      e.OrderType || 'MIXED',
      units:     Number(e.Units) || 0,
      price,
      impact,
      hasCSD:    csdHits.length > 0,
      description:
        `Trade executed via e-trade portal with no corresponding F-04 job order mandate found in history. ` +
        `${e.Client} — ${e.Security} — ${fmtN(e.Units)} units on ${fmtDate(date)}. ` +
        `This may be a legitimately self-directed trade or an unauthorised execution. Requires review.`,
      suggestedDescription:
        `Trade executed in client account via e-trade portal with no written mandate on file. ` +
        `${e.Security} ${fmtN(e.Units)} units on ${fmtDate(date)}. ` +
        `No corresponding jobbing order found. Requires confirmation from client that instruction was given.`,
      rootCause: 'misread_mandate',
      rootCauseDetail:
        `No F-04 mandate found for this security/client combination. ` +
        `Either (a) client traded self-directed via portal without desk involvement — may be legitimate, or ` +
        `(b) trade was executed without obtaining a valid written mandate — unauthorised trade.`,
      correctiveAction:
        `Review client communication records for this date. ` +
        `If client confirms they gave the instruction: document as self-directed and close. ` +
        `If no instruction can be confirmed: treat as unauthorised trade, notify Compliance Officer immediately, ` +
        `contact client to confirm or reverse position.`,
      jobRef:  null,
      channel: 'E-trade portal (no desk mandate)',
    })
  }

  return findings
}

// ── URGENCY CONFIG ────────────────────────────────────────────────────────────
function urgCfg(level) {
  if (level === 'CRITICAL') return { color: RED,   bg: RED_BG,   border: '#fca5a5', icon: '🔴' }
  if (level === 'HIGH')     return { color: AMBER, bg: AMBER_BG, border: '#ffe082', icon: '⚠️' }
  return                            { color: GREEN, bg: GREEN_BG, border: '#a5d6a7', icon: '🟢' }
}

const ruleLabels = {
  duplicate:    { label: 'Type 4 — Duplicate Trade',       icon: '🔁', color: RED   },
  partial_open: { label: 'Type 5 — Partial / Omitted',     icon: '⚠️', color: AMBER },
  no_mandate:   { label: 'Type 7 — Unauthorised / No Mandate', icon: '❓', color: BLUE  },
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function F06DetectionModule({ onPreFillF06 }) {
  const [files,    setFiles]    = useState([])
  const [parsed,   setParsed]   = useState([])
  const [findings, setFindings] = useState([])
  const [stage,    setStage]    = useState('upload')  // upload | results | review
  const [selected, setSelected] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsing,  setParsing]  = useState(false)
  const [dismissed, setDismissed] = useState(new Set())
  const fileRef = useState(null)[0] || { current: null }
  const inputRef = useState(null)

  const onDrop = useCallback(async e => {
    e.preventDefault(); setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))
    if (dropped.length) await processFiles(dropped)
  }, [])

  async function processFiles(rawFiles) {
    setParsing(true)
    try {
      const results = await Promise.all(rawFiles.map(async file => {
        // PDFs → AI extraction (Job Orders History format)
        if (file.name.toLowerCase().endsWith('.pdf')) {
          return await extractJobHistoryFromPDF(file)
        }
        // Excel → structural detection
        return await parseXLSX(file)
      }))
      const known = results.filter(r => r.type !== 'unknown')
      setParsed(known)
      setFiles(rawFiles)
      const found = runDetection(known)
      setFindings(found)
      setStage('results')
    } catch (err) {
      alert('Failed to read files: ' + err.message)
    }
    setParsing(false)
  }

  function reset() {
    setFiles([]); setParsed([]); setFindings([])
    setStage('upload'); setSelected(null); setDismissed(new Set())
  }

  const activeFindings = findings.filter(f => !dismissed.has(f.id))
  const criticals = activeFindings.filter(f => f.urgency === 'CRITICAL')
  const highs     = activeFindings.filter(f => f.urgency === 'HIGH')
  const standards = activeFindings.filter(f => f.urgency === 'STANDARD')

  // ── FILE TYPE SUMMARY ────────────────────────────────────────────────────────
  const fileTypeSummary = {
    job_history:    parsed.filter(f => f.type === 'job_history').length,
    fully_executed: parsed.filter(f => f.type === 'fully_executed').length,
    partial:        parsed.filter(f => f.type === 'partial').length,
    not_jobbed:     parsed.filter(f => f.type === 'not_jobbed').length,
    csd_log:        parsed.filter(f => f.type === 'csd_log').length,
  }
  const hasCSD = fileTypeSummary.csd_log > 0

  // ── UPLOAD STAGE ─────────────────────────────────────────────────────────────
  if (stage === 'upload') return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>
          Error Detection — Cross-Reference Analysis
        </div>
        <div style={{ fontSize: 13, color: '#5a6a82', lineHeight: 1.6 }}>
          Upload your F-04 Job Orders History and F-05 Jobbing Utilization files. The system will
          cross-reference them to surface potential error trades. CSD Trade Log is optional — if uploaded,
          financial impacts are calculated automatically.
        </div>
      </div>

      {/* What to upload */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { icon: '📋', label: 'Job Orders History', desc: 'From NaYa → Intelligence → Job Orders History (PDF or Excel)', required: true,  type: 'F-04' },
          { icon: '✅', label: 'Jobbing Utilization', desc: 'From NaYa → Intelligence → Jobbing Book Utilization (up to 3 sections)', required: true,  type: 'F-05' },
          { icon: '📊', label: 'CSD Trade Log', desc: 'From CSCS portal — provides execution prices for financial impact calculation', required: false, type: 'CSD' },
        ].map(f => (
          <div key={f.label} style={{ background: f.required ? '#f0f4ff' : SURFACE, border: `1px solid ${f.required ? '#c7d2fe' : BORDER}`, borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{f.icon}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: NAV }}>
                {f.label} {!f.required && <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('detect-file-input').click()}
        style={{
          border: `2px dashed ${dragOver ? GOLD : BORDER}`, borderRadius: 12,
          background: dragOver ? '#fef9ec' : '#fff',
          padding: '40px 32px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
        <div style={{ fontWeight: 600, color: NAV, fontSize: 14, marginBottom: 4 }}>
          Drop files here to run detection
        </div>
        <div style={{ color: '#888', fontSize: 12 }}>
          Select all files at once · .xlsx only · Job History + Utilization sections + optional CSD
        </div>
        <input
          id="detect-file-input"
          type="file"
          accept=".xlsx,.xls,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files.length) processFiles(Array.from(e.target.files)) }}
        />
      </div>

      {parsing && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: AMBER, fontSize: 13, fontWeight: 600 }}>
          ⚙️ Analysing files…
        </div>
      )}
    </div>
  )

  // ── RESULTS STAGE ────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 4 }}>
            Detection Results
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {parsed.length} file{parsed.length !== 1 ? 's' : ''} analysed ·
            {fileTypeSummary.job_history} Job History · {fileTypeSummary.fully_executed + fileTypeSummary.partial + fileTypeSummary.not_jobbed} Utilization sections ·
            {hasCSD ? <span style={{ color: GREEN }}> ✓ CSD prices available</span> : <span style={{ color: AMBER }}> ⚠ No CSD — impacts estimated</span>}
          </div>
        </div>
        <button onClick={reset}
          style={{ background: 'transparent', border: `1.5px solid ${BORDER}`, borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer', color: '#374151' }}>
          ← New Analysis
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Candidates', v: activeFindings.length, color: NAV },
          { label: 'Critical',   v: criticals.length, color: RED   },
          { label: 'High',       v: highs.length,     color: AMBER },
          { label: 'Standard',   v: standards.length, color: GREEN },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'Playfair Display', serif" }}>{s.v}</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {activeFindings.length === 0 ? (
        <div style={{ background: GREEN_BG, border: `1.5px solid #a5d6a7`, borderRadius: 10, padding: '24px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: GREEN, fontSize: 15 }}>No error candidates detected</div>
          <div style={{ fontSize: 12, color: '#374151', marginTop: 4 }}>All uploaded F-04 and F-05 data appears consistent. No anomalies found.</div>
        </div>
      ) : (
        <div>
          {!hasCSD && (
            <div style={{ background: AMBER_BG, border: `1px solid #ffe082`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: AMBER }}>
              <strong>⚠ CSD Trade Log not uploaded.</strong> Financial impacts shown as "— estimate required". Upload the CSD file and re-run to auto-calculate impacts and urgency classification.
            </div>
          )}

          {/* Findings list */}
          {activeFindings.map(f => {
            const ug  = urgCfg(f.urgency)
            const rl  = ruleLabels[f.rule]
            const sel = selected?.id === f.id
            return (
              <div key={f.id}
                style={{
                  background: '#fff', border: `1.5px solid ${sel ? GOLD : BORDER}`,
                  borderLeft: `5px solid ${ug.color}`,
                  borderRadius: 10, marginBottom: 12, overflow: 'hidden',
                  boxShadow: sel ? '0 4px 16px rgba(201,168,76,0.15)' : '0 1px 3px rgba(0,0,0,0.05)',
                }}>
                {/* Finding header */}
                <div
                  onClick={() => setSelected(sel ? null : f)}
                  style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 12 }}
                >
                  <div style={{ flexShrink: 0, marginTop: 2 }}>
                    <span style={{ background: ug.bg, color: ug.color, border: `1px solid ${ug.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700 }}>
                      {ug.icon} {f.urgency}
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: NAV }}>{f.security}</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>·</span>
                      <span style={{ fontSize: 12, color: '#374151' }}>{f.client}</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>·</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(f.date)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ background: '#f0f0f0', color: rl?.color || '#374151', borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 700 }}>
                        {rl?.icon} {rl?.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#374151' }}>
                        {f.side} {fmtN(f.units)} units
                        {f.outstanding ? ` · ${fmtN(f.outstanding)} outstanding` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#5a6a82', lineHeight: 1.6 }}>{f.description}</div>
                    <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: f.impact > 0 ? (f.urgency === 'CRITICAL' ? RED : f.urgency === 'HIGH' ? AMBER : GREEN) : '#9ca3af' }}>
                      Financial impact: {fmtNGN(f.impact > 0 ? f.impact : null)}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: GOLD, flexShrink: 0 }}>{sel ? '−' : '+'}</div>
                </div>

                {/* Expanded detail + actions */}
                {sel && (
                  <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px 18px', background: SURFACE }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                      Pre-filled F-06 data — review before logging
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      {[
                        { label: 'CSCS Number',   value: f.cscs },
                        { label: 'Channel',       value: f.channel },
                        { label: 'Execution Price', value: f.price > 0 ? `₦${f.price.toLocaleString()}` : '— not available (no CSD)' },
                        { label: 'Root Cause Category', value: f.rootCause.replace(/_/g, ' ') },
                      ].map(d => (
                        <div key={d.label}>
                          <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{d.label}</div>
                          <div style={{ fontSize: 12, color: NAV, fontWeight: 500 }}>{d.value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Suggested Error Description</div>
                      <div style={{ fontSize: 12, color: '#374151', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', lineHeight: 1.7 }}>
                        {f.suggestedDescription}
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Suggested Corrective Action</div>
                      <div style={{ fontSize: 12, color: '#374151', background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', lineHeight: 1.7 }}>
                        {f.correctiveAction}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => {
                          onPreFillF06({
                            error_date:          f.date,
                            discovery_date:      new Date().toISOString().split('T')[0],
                            error_type:          f.errorType,
                            security:            f.security,
                            client_account:      f.cscs,
                            client_name:         f.client,
                            cscs_no:             f.cscs,
                            error_description:   f.suggestedDescription,
                            impact_client:       f.impact > 0 ? String(-Math.abs(f.impact)) : '',
                            impact_firm:         '',
                            compensation_paid:   '0',
                            root_cause_category: f.rootCause,
                            root_cause_detail:   f.rootCauseDetail,
                            corrective_action:   f.correctiveAction,
                            notes:               `Auto-detected by F-04 × F-05 cross-reference. ${f.hasCSD ? 'CSD confirmed.' : 'CSD not uploaded — verify financial impact.'}`,
                          })
                        }}
                        style={{ background: GOLD, color: NAV, border: 'none', borderRadius: 8, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                        → Log as F-06 Error Trade
                      </button>
                      <button
                        onClick={() => { setDismissed(prev => new Set([...prev, f.id])); setSelected(null) }}
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
              {dismissed.size} finding{dismissed.size !== 1 ? 's' : ''} dismissed.
              <button onClick={() => setDismissed(new Set())}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: AMBER, fontSize: 12, marginLeft: 6 }}>
                Restore all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
