import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { printDailyF05 } from '../lib/f05Print'
import F05ReportGenerator from './F05ReportGenerator'

// ── Constants ────────────────────────────────────────────────────────────────
const NAV       = '#0d1f3c'
const GOLD      = '#c9a84c'
const GOLD_LIGHT= '#f5e6c0'
const SURFACE   = '#f7f8fa'
const BORDER    = '#dde1ea'
const GREEN     = '#1a7a4a'
const GREEN_BG  = '#e8f5e9'
const AMBER     = '#b45309'
const AMBER_BG  = '#fff8e1'
const BLUE      = '#1565c0'
const BLUE_BG   = '#e3f0ff'
const RED       = '#c0392b'
const RED_BG    = '#fdecea'

// ── Section detection ────────────────────────────────────────────────────────
// NaYa produces 4 structurally distinct file types.
function detectSection(rows, headers) {
  const colCount   = headers.filter(Boolean).length
  const orderTypes = new Set(rows.map(r => r.OrderType).filter(Boolean))
  const hasMixed   = orderTypes.has('MIXED')
  const hasPartial = headers.includes('UnitsJobbed')       // Partial utilization
  const isJobHist  = headers.includes('RefNo') && headers.includes('JobbedUnits')  // Job Orders History

  if (isJobHist)                           return 'job_history'
  if (hasPartial)                          return 'partial'
  if (colCount === 6 && hasMixed)          return 'not_jobbed'
  if (colCount === 6 && !hasMixed)         return 'fully_executed'
  return 'unknown'
}

// ── Parse a single XLSX file ─────────────────────────────────────────────────
function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb    = XLSX.read(e.target.result, { type: 'array' })
        const ws    = wb.Sheets[wb.SheetNames[0]]
        const raw   = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

        // Row 1 = title, Row 2 = headers, Row 3+ = data
        const headers = (raw[1] || []).map(h => h ? String(h).trim() : null)
        const dataRows = raw.slice(2).filter(row => row.some(c => c !== null))

        const rows = dataRows.map(row => {
          const obj = {}
          headers.forEach((h, i) => { if (h) obj[h] = row[i] })
          return obj
        })

        const section = detectSection(rows, headers)
        resolve({ section, headers, rows, fileName: file.name })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── Format date from NaYa (strips "Reverse" if present) ─────────────────────
function fmtDate(val) {
  if (!val) return '—'
  return String(val).replace(/Reverse$/i, '').trim()
}

function fmtNum(val) {
  if (val === null || val === undefined) return '—'
  return Number(val).toLocaleString()
}

// ── Section config ────────────────────────────────────────────────────────────
const SECTIONS = {
  fully_executed: {
    label:  'Fully Executed Trades',
    sub:    'Jobbed and traded in full — no action required',
    icon:   '✅', color: GREEN, bg: GREEN_BG, border: '#a5d6a7',
  },
  partial: {
    label:  'Partially Executed Trades',
    sub:    'Jobbed but only partially filled — outstanding units remain',
    icon:   '⚠️', color: AMBER, bg: AMBER_BG, border: '#ffe082',
  },
  not_jobbed: {
    label:  'Executed Trades Not Jobbed',
    sub:    'Executed via e-trade portal — no job order (self-directed)',
    icon:   '🔵', color: BLUE, bg: BLUE_BG, border: '#90caf9',
  },
  unexecuted: {
    label:  'Jobbed But Not Executed',
    sub:    'Client mandate was entered and approved — but never traded on NGX',
    icon:   '🔴', color: RED, bg: RED_BG, border: '#fca5a5',
  },
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReconciliationUpload({ currentUser }) {
  const [stage, setStage]           = useState('upload') // upload|parsed|saving|done
  const [dragOver, setDragOver]     = useState(false)
  const [files, setFiles]           = useState([])       // [{section, rows, headers, fileName}]
  const [parseError, setParseError] = useState('')
  const [tradeDate, setTradeDate]   = useState('')
  const [approverNote, setApproverNote] = useState('')
  const [savedId, setSavedId]       = useState(null)
  const [history, setHistory]       = useState([])
  const [viewSession, setViewSession] = useState(null)
  const fileRef = useRef()

  useEffect(() => { loadHistory() }, [])

  async function loadHistory() {
    const { data } = await supabase
      .from('reconciliation_sessions')
      .select('id,trade_date,status,approver_name,approved_at,fully_executed_count,partial_count,not_jobbed_count,unexecuted_count')
      .order('trade_date', { ascending: false })
      .limit(20)
    setHistory(data || [])
  }

  // ── File ingestion ──────────────────────────────────────────────────────────
  const processFiles = useCallback(async (rawFiles) => {
    setParseError('')
    const xlsxFiles = Array.from(rawFiles).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    )
    if (xlsxFiles.length === 0) {
      setParseError('Please upload Excel (.xlsx) files exported from NaYa.')
      return
    }
    if (xlsxFiles.length > 4) {
      setParseError('Maximum 4 files: up to 3 Jobbing Utilization sections + 1 Job Orders History.')
      return
    }

    try {
      const parsed = await Promise.all(xlsxFiles.map(parseXLSX))

      // Validate — check for unknown sections
      const unknown = parsed.filter(p => p.section === 'unknown')
      if (unknown.length > 0) {
        setParseError(`Could not identify file type for: ${unknown.map(u => u.fileName).join(', ')}.`)
        return
      }

      // Check for duplicate utilization sections (job_history can appear once)
      const utilSections = parsed.filter(p => p.section !== 'job_history').map(p => p.section)
      const dupes = utilSections.filter((s, i) => utilSections.indexOf(s) !== i)
      if (dupes.length > 0) {
        setParseError(`Duplicate section detected: ${dupes[0]}. You uploaded two files of the same type.`)
        return
      }

      // ── Cross-reference: find unexecuted jobs ──────────────────────────────
      const jobHistFiles = parsed.filter(p => p.section === 'job_history')
      const utilFiles    = parsed.filter(p => p.section !== 'job_history')

      let processedFiles = [...utilFiles]

      if (jobHistFiles.length > 0) {
        // Merge all job history rows, deduplicate by RefNo
        const allJobRows = jobHistFiles.flatMap(f => f.rows)
        const seenRefs = new Set()
        const uniqueJobs = allJobRows.filter(r => {
          const key = String(r.RefNo || '')
          if (seenRefs.has(key)) return false
          seenRefs.add(key)
          return true
        })

        // Build execution lookup from utilization files: "CSCS|STOCK|SIDE" → true
        const execKeys = new Set()
        utilFiles.forEach(f => {
          f.rows.forEach(r => {
            if (r.OrderType !== 'MIXED') { // exclude e-trade
              execKeys.add(`${r.CSCSAccNum}|${r.Security}|${r.OrderType}`)
            }
          })
        })

        // Jobs where no matching execution exists
        const unexecutedRows = uniqueJobs.filter(j => {
          const key = `${j.CSCSNo}|${j.Stock}|${j.ExecOrder}`
          return !execKeys.has(key)
        })

        if (unexecutedRows.length > 0) {
          processedFiles.push({
            section: 'unexecuted',
            headers: ['RefNo', 'EffectiveDate', 'ExpiryDate', 'Client', 'CSCSNo', 'Stock', 'ExecOrder', 'JobbedUnits', 'EnteredBy', 'ApprovedBy'],
            rows: unexecutedRows,
            fileName: 'cross-reference',
          })
        }
      }

      // Extract trade date from utilization rows
      const utilRows = utilFiles.flatMap(f => f.rows)
      if (utilRows.length > 0 && utilRows[0].EffectiveDate) {
        const rawDate = fmtDate(utilRows[0].EffectiveDate)
        const parts = rawDate.split('/')
        if (parts.length === 3) {
          setTradeDate(`${parts[2]}-${parts[1]}-${parts[0]}`)
        }
      }

      setFiles(processedFiles)
      setStage('parsed')
    } catch (err) {
      setParseError('Failed to read files: ' + err.message)
    }
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }

  // ── Approve & Save ──────────────────────────────────────────────────────────
  async function approveAndSave() {
    if (!tradeDate) { alert('Trade date is required.'); return }
    setStage('saving')

    try {
      const fullyExec = files.find(f => f.section === 'fully_executed')
      const partial   = files.find(f => f.section === 'partial')
      const notJobbed = files.find(f => f.section === 'not_jobbed')

      const unexecuted = files.find(f => f.section === 'unexecuted')

      // Insert session header
      const { data: session, error: sessionErr } = await supabase
        .from('reconciliation_sessions')
        .insert({
          trade_date:            tradeDate,
          status:                'approved',
          approver_name:         currentUser || 'Admin',
          approver_note:         approverNote,
          approved_at:           new Date().toISOString(),
          fully_executed_count:  fullyExec?.rows.length  || 0,
          partial_count:         partial?.rows.length    || 0,
          not_jobbed_count:      notJobbed?.rows.length  || 0,
          unexecuted_count:      unexecuted?.rows.length || 0,
          created_by:            currentUser || 'Admin',
        })
        .select().single()

      if (sessionErr) throw sessionErr

      // Build lines array
      const lines = []

      ;(fullyExec?.rows || []).forEach(r => lines.push({
        session_id:       session.id,
        section_type:     'fully_executed',
        effective_date:   fmtDate(r.EffectiveDate),
        client:           r.Client,
        cscs_acc_num:     String(r.CSCSAccNum || ''),
        order_type:       r.OrderType,
        security:         r.Security,
        units:            Number(r.Units) || 0,
        units_jobbed:     null,
        units_traded:     null,
        units_outstanding:null,
      }))

      ;(partial?.rows || []).forEach(r => lines.push({
        session_id:        session.id,
        section_type:      'partial',
        effective_date:    fmtDate(r.EffectiveDate),
        client:            r.Client,
        cscs_acc_num:      String(r.CSCSAccNum || ''),
        order_type:        r.OrderType,
        security:          r.Security,
        units:             null,
        units_jobbed:      Number(r.UnitsJobbed)      || 0,
        units_traded:      Number(r.UnitsTraded)      || 0,
        units_outstanding: Number(r.UnitsOutstanding) || 0,
      }))

      ;(notJobbed?.rows || []).forEach(r => lines.push({
        session_id:        session.id,
        section_type:      'not_jobbed',
        effective_date:    fmtDate(r.EffectiveDate),
        client:            r.Client,
        cscs_acc_num:      String(r.CSCSAccNum || ''),
        order_type:        r.OrderType,
        security:          r.Security,
        units:             Number(r.Units) || 0,
        units_jobbed:      null,
        units_traded:      null,
        units_outstanding: null,
      }))

      // Unexecuted jobs
      ;(unexecuted?.rows || []).forEach(r => lines.push({
        session_id:        session.id,
        section_type:      'unexecuted',
        effective_date:    fmtDate(r.EffectiveDate),
        client:            r.Client,
        cscs_acc_num:      String(r.CSCSNo || ''),
        order_type:        r.ExecOrder,
        security:          r.Stock,
        units:             Number(r.JobbedUnits) || 0,
        units_jobbed:      null,
        units_traded:      null,
        units_outstanding: null,
        ref_no:            String(r.RefNo || ''),
        expiry_date:       fmtDate(r.ExpiryDate),
        entered_by:        r.EnteredBy || null,
        approved_by:       r.ApprovedBy || null,
      }))

      if (lines.length > 0) {
        const { error: linesErr } = await supabase
          .from('reconciliation_lines')
          .insert(lines)
        if (linesErr) throw linesErr
      }

      setSavedId(session.id)
      setStage('done')
      loadHistory()
    } catch (err) {
      setParseError('Save failed: ' + err.message)
      setStage('parsed')
    }
  }

  function reset() {
    setStage('upload')
    setFiles([])
    setParseError('')
    setTradeDate('')
    setApproverNote('')
    setSavedId(null)
  }

  // ── Open history session ────────────────────────────────────────────────────
  async function openSession(id) {
    const { data: s } = await supabase
      .from('reconciliation_sessions')
      .select('*').eq('id', id).single()
    const { data: lines } = await supabase
      .from('reconciliation_lines')
      .select('*').eq('session_id', id).order('section_type')
    setViewSession({ ...s, lines: lines || [] })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: NAV, minHeight: '100vh', background: SURFACE }}>

      {/* Header */}
      <div style={{
        background: NAV, borderBottom: `3px solid ${GOLD}`,
        padding: '20px 32px',
      }}>
        <div style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
          Form F-05 · Trading Controls
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
          Daily Trade Reconciliation
        </div>
        <div style={{ color: '#8fa3c0', fontSize: 12, marginTop: 2 }}>
          Jobbing Book Utilization + Job Orders History · Auto-detection · Compliance sign-off
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', minHeight: 'calc(100vh - 82px)' }}>

        {/* ── Main ── */}
        <div style={{ padding: 32, borderRight: `1px solid ${BORDER}` }}>

          {/* UPLOAD */}
          {stage === 'upload' && (
            <div>
              <PageTitle>Upload Today's Jobbing Book Utilization</PageTitle>
              <p style={{ color: '#5a6a82', fontSize: 13, marginBottom: 8, lineHeight: 1.7 }}>
                From NaYa: <strong>Intelligence → Jobbing Book Utilization</strong> → export up to 3 sections.
                Also export <strong>Intelligence → Job Orders History</strong> for the same date to detect unexecuted mandates.
              </p>
              <p style={{ color: AMBER, fontSize: 12, marginBottom: 24, lineHeight: 1.6,
                background: AMBER_BG, padding: '8px 12px', borderRadius: 6, display: 'inline-block' }}>
                ⓘ Drop all files at once (up to 4). Job Orders History is optional but recommended — it reveals mandates that were jobbed but never traded.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current.click()}
                style={{
                  border: `2px dashed ${dragOver ? GOLD : BORDER}`,
                  borderRadius: 12, background: dragOver ? GOLD_LIGHT : '#fff',
                  padding: '56px 32px', textAlign: 'center', cursor: 'pointer',
                  transition: 'all 0.2s', marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 600, color: NAV, fontSize: 15, marginBottom: 6 }}>
                  Drop Jobbing Book Utilization files here
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>
                  Up to 3 .xlsx files · Select all and drop at once · or click to browse
                </div>
                <input ref={fileRef} type="file" accept=".xlsx,.xls" multiple
                  style={{ display: 'none' }}
                  onChange={e => processFiles(e.target.files)} />
              </div>

              {parseError && <ErrorBox msg={parseError} />}
            </div>
          )}

          {/* ── Period Reports ── */}
          {(stage === 'upload' || stage === 'done') && (
            <div style={{ marginTop: 40, borderTop: `2px solid ${BORDER}`, paddingTop: 32 }}>
              <F05ReportGenerator />
            </div>
          )}

          {/* PARSED / REVIEW */}
          {stage === 'parsed' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <PageTitle>Review Reconciliation Results</PageTitle>
                  <div style={{ fontSize: 12, color: '#5a6a82' }}>
                    {files.length} file{files.length !== 1 ? 's' : ''} detected ·
                    {files.reduce((a, f) => a + f.rows.length, 0)} total records
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600 }}>Trade Date</label>
                  <input type="date" value={tradeDate}
                    onChange={e => setTradeDate(e.target.value)}
                    style={inputStyle} />
                </div>
              </div>

              {parseError && <ErrorBox msg={parseError} />}

              {/* Summary pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
                {['fully_executed', 'partial', 'not_jobbed', 'unexecuted'].map(key => {
                  const found = files.find(f => f.section === key)
                  const cfg   = SECTIONS[key]
                  return (
                    <div key={key} style={{
                      background: found ? cfg.bg : '#f0f0f0',
                      border: `1px solid ${found ? cfg.border : '#ddd'}`,
                      borderRadius: 8, padding: '10px 16px',
                      opacity: found ? 1 : 0.5,
                    }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{cfg.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 20, color: found ? cfg.color : '#aaa' }}>
                        {found ? found.rows.length : '—'}
                      </div>
                      <div style={{ fontSize: 11, color: '#5a6a82', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cfg.label}
                      </div>
                      {!found && key === 'unexecuted' && (
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Upload Job Orders History to detect</div>
                      )}
                      {!found && key !== 'unexecuted' && (
                        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>Not uploaded (0 records)</div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Section tables */}
              {['fully_executed', 'partial', 'not_jobbed', 'unexecuted'].map(key => {
                const found = files.find(f => f.section === key)
                if (!found) return null
                const cfg = SECTIONS[key]
                return (
                  <div key={key} style={{ marginBottom: 28 }}>
                    <div style={{
                      background: cfg.bg, border: `1px solid ${cfg.border}`,
                      borderRadius: '8px 8px 0 0', padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: cfg.color, fontSize: 14 }}>{cfg.label}</div>
                        <div style={{ fontSize: 11, color: '#5a6a82' }}>{cfg.sub}</div>
                      </div>
                      <div style={{
                        marginLeft: 'auto', background: cfg.color, color: '#fff',
                        borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700,
                      }}>
                        {found.rows.length} record{found.rows.length !== 1 ? 's' : ''}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto', border: `1px solid ${cfg.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
                      {key === 'partial'    ? <PartialTable     rows={found.rows} /> :
                       key === 'unexecuted' ? <UnexecutedTable  rows={found.rows} /> :
                                             <StandardTable     rows={found.rows} />}
                    </div>
                  </div>
                )
              })}

              {/* Approval box */}
              <div style={{
                background: '#fff', border: `2px solid ${GOLD}`,
                borderRadius: 10, padding: '20px 24px', marginTop: 8,
              }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: NAV, marginBottom: 4 }}>
                  Compliance Approval — F-05
                </div>
                <div style={{ fontSize: 12, color: '#5a6a82', marginBottom: 16, lineHeight: 1.6 }}>
                  By approving, you confirm this reconciliation is accurate and complete for the trading day.
                  This record will be locked with your name and timestamp.
                </div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Approving as</label>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: NAV,
                      background: SURFACE, padding: '8px 12px', borderRadius: 6,
                    }}>
                      {currentUser || 'Current User'}
                    </div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Notes (optional)</label>
                    <textarea
                      value={approverNote}
                      onChange={e => setApproverNote(e.target.value)}
                      placeholder="Any remarks on today's reconciliation…"
                      rows={2}
                      style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
                    />
                  </div>
                </div>

                {/* Flags summary before approval */}
                {files.some(f => f.section === 'partial' && f.rows.length > 0) && (
                  <div style={{
                    background: AMBER_BG, border: `1px solid #ffe082`,
                    borderRadius: 6, padding: '8px 14px', fontSize: 12,
                    color: AMBER, marginBottom: 14,
                  }}>
                    ⚠️ <strong>{files.find(f => f.section === 'partial').rows.length} partial fill(s)</strong> detected.
                    Outstanding units will need follow-up on the next trading day.
                  </div>
                )}
                {files.some(f => f.section === 'not_jobbed' && f.rows.length > 0) && (
                  <div style={{
                    background: BLUE_BG, border: `1px solid #90caf9`,
                    borderRadius: 6, padding: '8px 14px', fontSize: 12,
                    color: BLUE, marginBottom: 14,
                  }}>
                    🔵 <strong>{files.find(f => f.section === 'not_jobbed').rows.length} self-directed trade(s)</strong> executed via e-trade portal without a job order. Confirm these are expected.
                  </div>
                )}

                {files.some(f => f.section === 'unexecuted' && f.rows.length > 0) && (
                  <div style={{
                    background: RED_BG, border: `1px solid #fca5a5`,
                    borderRadius: 6, padding: '8px 14px', fontSize: 12,
                    color: RED, marginBottom: 14,
                  }}>
                    🔴 <strong>{files.find(f => f.section === 'unexecuted').rows.length} unexecuted mandate(s)</strong> — client instructions were jobbed and approved but never traded on NGX. Each requires documented explanation before locking.
                  </div>
                )}

                <button onClick={approveAndSave} style={{
                  background: GOLD, color: NAV, border: 'none', borderRadius: 8,
                  padding: '12px 32px', fontWeight: 700, fontSize: 14,
                  fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer',
                }}>
                  ✓ Approve & Lock F-05
                </button>
                <span style={{ fontSize: 11, color: '#5a6a82', marginLeft: 12 }}>
                  {tradeDate}
                </span>
              </div>
            </div>
          )}

          {/* SAVING */}
          {stage === 'saving' && (
            <div style={{ textAlign: 'center', padding: '80px 32px' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>💾</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 8 }}>
                Saving reconciliation…
              </div>
              <LoadingDots />
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '80px 32px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: GREEN, marginBottom: 8 }}>
                F-05 Approved & Locked
              </div>
              <div style={{ fontSize: 13, color: '#5a6a82', marginBottom: 6 }}>
                Trade date: <strong>{tradeDate}</strong>
              </div>
              <div style={{ fontSize: 13, color: '#5a6a82', marginBottom: 32 }}>
                Session ID: <code style={{ background: '#eee', padding: '2px 6px', borderRadius: 4 }}>{savedId}</code>
              </div>
              <div style={{
                background: GREEN_BG, border: `1px solid #a5d6a7`,
                borderRadius: 10, padding: '16px 24px', display: 'inline-block',
                textAlign: 'left', marginBottom: 32, maxWidth: 420,
              }}>
                <div style={{ fontWeight: 700, color: GREEN, fontSize: 13, marginBottom: 6 }}>Reconciliation complete</div>
                <div style={{ fontSize: 12, color: '#2d5a3d', lineHeight: 1.8 }}>
                  • F-05 record locked with your name and timestamp<br />
                  • Partial fills are flagged for follow-up tomorrow<br />
                  • Self-directed trades are recorded as acknowledged<br />
                  {files.some(f => f.section === 'unexecuted' && f.rows.length > 0) && (
                    <span>• ⚠️ {files.find(f => f.section === 'unexecuted').rows.length} unexecuted mandate(s) recorded — follow up required<br /></span>
                  )}
                  • All records are available for audit at any time
                </div>
              </div>
              <div>
                <button onClick={reset} style={{
                  background: GOLD, color: NAV, border: 'none', borderRadius: 8,
                  padding: '12px 28px', fontWeight: 700, fontSize: 14,
                  fontFamily: "'IBM Plex Sans', sans-serif", cursor: 'pointer',
                }}>
                  Reconcile Another Day
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar history ── */}
        <div style={{ background: '#fff', padding: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: GOLD,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16,
          }}>
            Recent F-05 Records
          </div>

          {history.length === 0 && (
            <div style={{ fontSize: 12, color: '#aaa' }}>No records yet</div>
          )}

          {history.map(s => (
            <div key={s.id}
              onClick={() => openSession(s.id)}
              style={{
                border: `1px solid ${BORDER}`, borderRadius: 8,
                padding: '12px 14px', marginBottom: 10, cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = GOLD}
              onMouseOut={e  => e.currentTarget.style.borderColor = BORDER}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: NAV }}>
                  {formatDate(s.trade_date)}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1,
                  textTransform: 'uppercase', color: GREEN,
                  background: GREEN_BG, padding: '2px 8px', borderRadius: 20,
                }}>
                  Approved
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Pill count={s.fully_executed_count} label="executed"    color={GREEN} bg={GREEN_BG} />
                <Pill count={s.partial_count}        label="partial"     color={AMBER} bg={AMBER_BG} />
                <Pill count={s.not_jobbed_count}     label="e-trade"     color={BLUE}  bg={BLUE_BG}  />
                <Pill count={s.unexecuted_count}     label="unexecuted"  color={RED}   bg={RED_BG}   />
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 6 }}>
                {s.approver_name}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* ── Session detail modal ── */}
      {viewSession && (
        <SessionModal session={viewSession} onClose={() => setViewSession(null)} />
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StandardTable({ rows }) {
  if (!rows.length) return <EmptyTable />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: NAV, color: '#fff' }}>
          {['Date', 'Client', 'CSCS No', 'Order Type', 'Security', 'Units'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : SURFACE, borderBottom: `1px solid ${BORDER}` }}>
            <td style={tdStyle}>{fmtDate(r.EffectiveDate)}</td>
            <td style={tdStyle}>{r.Client}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.CSCSAccNum}</td>
            <td style={tdStyle}>
              <span style={{
                background: r.OrderType === 'SELL' ? '#fdecea' : r.OrderType === 'BUY' ? GREEN_BG : BLUE_BG,
                color: r.OrderType === 'SELL' ? RED : r.OrderType === 'BUY' ? GREEN : BLUE,
                fontWeight: 700, borderRadius: 4, padding: '2px 8px', fontSize: 11,
              }}>
                {r.OrderType}
              </span>
            </td>
            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace' }}>{r.Security}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(r.Units)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PartialTable({ rows }) {
  if (!rows.length) return <EmptyTable />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: NAV, color: '#fff' }}>
          {['Date', 'Client', 'CSCS No', 'Order Type', 'Security', 'Jobbed', 'Traded', 'Outstanding'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: AMBER_BG, borderBottom: `1px solid #ffe082` }}>
            <td style={tdStyle}>{fmtDate(r.EffectiveDate)}</td>
            <td style={tdStyle}>{r.Client}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.CSCSAccNum}</td>
            <td style={tdStyle}>
              <span style={{
                background: GREEN_BG, color: GREEN,
                fontWeight: 700, borderRadius: 4, padding: '2px 8px', fontSize: 11,
              }}>
                {r.OrderType}
              </span>
            </td>
            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace' }}>{r.Security}</td>
            <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNum(r.UnitsJobbed)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: GREEN, fontWeight: 600 }}>{fmtNum(r.UnitsTraded)}</td>
            <td style={{ ...tdStyle, textAlign: 'right', color: AMBER, fontWeight: 700 }}>
              {fmtNum(r.UnitsOutstanding)} ⚠️
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function UnexecutedTable({ rows }) {
  if (!rows.length) return <EmptyTable />
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: RED, color: '#fff' }}>
          {['Ref No', 'Date', 'Expiry', 'Client', 'CSCS No', 'Security', 'Side', 'Jobbed Units', 'Entered By', 'Approved By'].map(h => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? RED_BG : '#fff5f5', borderBottom: '1px solid #fca5a5' }}>
            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 700, color: RED }}>{r.RefNo}</td>
            <td style={tdStyle}>{fmtDate(r.EffectiveDate)}</td>
            <td style={{ ...tdStyle, color: AMBER }}>{fmtDate(r.ExpiryDate)}</td>
            <td style={{ ...tdStyle, fontWeight: 600 }}>{r.Client}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.CSCSNo}</td>
            <td style={{ ...tdStyle, fontWeight: 700, fontFamily: 'monospace' }}>{r.Stock}</td>
            <td style={tdStyle}>
              <span style={{
                background: r.ExecOrder === 'SELL' ? '#fdecea' : GREEN_BG,
                color: r.ExecOrder === 'SELL' ? RED : GREEN,
                fontWeight: 700, borderRadius: 4, padding: '2px 8px', fontSize: 11,
              }}>{r.ExecOrder}</span>
            </td>
            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: RED }}>{fmtNum(r.JobbedUnits)}</td>
            <td style={{ ...tdStyle, fontSize: 11, color: '#5a6a82' }}>{r.EnteredBy || '—'}</td>
            <td style={{ ...tdStyle, fontSize: 11, color: '#5a6a82' }}>{r.ApprovedBy || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SessionModal({ session, onClose }) {
  const bySection = {
    fully_executed: session.lines.filter(l => l.section_type === 'fully_executed'),
    partial:        session.lines.filter(l => l.section_type === 'partial'),
    not_jobbed:     session.lines.filter(l => l.section_type === 'not_jobbed'),
    unexecuted:     session.lines.filter(l => l.section_type === 'unexecuted'),
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '92%', maxWidth: 1000,
        maxHeight: '88vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          background: NAV, padding: '20px 28px', borderRadius: '12px 12px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>F-05 Record</div>
            <div style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>
              {formatDate(session.trade_date)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#8fa3c0' }}>
              Approved by {session.approver_name} · {session.approved_at ? new Date(session.approved_at).toLocaleString() : ''}
            </div>
            <button
              onClick={() => printDailyF05(session)}
              style={{
                background: '#c9a84c', border: 'none', color: '#0d1f3c',
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif",
              }}>
              🖨 Print / PDF
            </button>
            <button onClick={onClose} style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff',
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
            }}>Close</button>
          </div>
        </div>

        <div style={{ padding: 28 }}>
          {session.approver_note && (
            <div style={{ background: GOLD_LIGHT, borderRadius: 8, padding: '10px 16px', fontSize: 13, color: NAV, marginBottom: 20 }}>
              <strong>Note:</strong> {session.approver_note}
            </div>
          )}

          {['fully_executed', 'partial', 'not_jobbed'].map(key => {
            const lines = bySection[key]
            if (!lines.length) return null
            const cfg = SECTIONS[key]
            return (
              <div key={key} style={{ marginBottom: 24 }}>
                <div style={{
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  borderRadius: '8px 8px 0 0', padding: '10px 16px',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontWeight: 700, color: cfg.color, fontSize: 13 }}>{cfg.label}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color: cfg.color, fontWeight: 600 }}>
                    {lines.length} record{lines.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ border: `1px solid ${cfg.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', overflowX: 'auto' }}>
                  {key === 'partial' ? (
                    <PartialTable rows={lines.map(l => ({
                      EffectiveDate: l.effective_date,
                      Client: l.client, CSCSAccNum: l.cscs_acc_num,
                      OrderType: l.order_type, Security: l.security,
                      UnitsJobbed: l.units_jobbed, UnitsTraded: l.units_traded,
                      UnitsOutstanding: l.units_outstanding,
                    }))} />
                  ) : (
                    <StandardTable rows={lines.map(l => ({
                      EffectiveDate: l.effective_date,
                      Client: l.client, CSCSAccNum: l.cscs_acc_num,
                      OrderType: l.order_type, Security: l.security,
                      Units: l.units,
                    }))} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Pill({ count, label, color, bg }) {
  if (!count) return null
  return (
    <span style={{
      background: bg, color, fontSize: 10, fontWeight: 700,
      padding: '2px 8px', borderRadius: 20,
    }}>
      {count} {label}
    </span>
  )
}

function EmptyTable() {
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 12 }}>
      No records in this section
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div style={{
      background: RED_BG, border: `1px solid ${RED}`,
      color: RED, borderRadius: 8, padding: '10px 14px',
      fontSize: 13, marginBottom: 16,
    }}>
      {msg}
    </div>
  )
}

function PageTitle({ children }) {
  return (
    <div style={{
      fontSize: 17, fontFamily: "'Playfair Display', serif",
      fontWeight: 700, color: NAV, marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: '50%', background: GOLD,
          animation: 'bounce 1.2s infinite',
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
    </div>
  )
}

function formatDate(d) {
  if (!d) return '—'
  // Append T12:00:00 so date-only strings are parsed as local noon, not UTC midnight
  // (UTC midnight = previous day in US/EU timezones)
  const safe = String(d).includes('T') ? d : d + 'T12:00:00'
  return new Date(safe).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: NAV, outline: 'none', background: '#fff',
  fontFamily: "'IBM Plex Sans', sans-serif",
}
const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: 0.5, color: NAV, marginBottom: 6,
}
const thStyle = { padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }
const tdStyle = { padding: '8px 12px', verticalAlign: 'middle' }
