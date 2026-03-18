import { useState } from 'react'
import { Link } from 'react-router-dom'

const NAV    = '#0d1f3c'
const GOLD   = '#c9a84c'
const GREEN  = '#1a7a4a'
const GREEN_BG = '#e8f5e9'
const AMBER  = '#b45309'
const AMBER_BG = '#fff8e1'
const RED    = '#c0392b'
const RED_BG = '#fdecea'
const BLUE   = '#1565c0'
const BLUE_BG = '#e3f0ff'
const BORDER = '#dde1ea'
const SURFACE = '#f7f8fa'

const SECTIONS = [
  { id: 'overview',  label: 'Overview',          icon: '🏠' },
  { id: 'daily',     label: 'Daily Workflow',     icon: '📅' },
  { id: 'f04',       label: 'F-04 Mandate Import', icon: '📋' },
  { id: 'f05',       label: 'F-05 Reconciliation', icon: '⚖️' },
  { id: 'f06',       label: 'F-06 Error Detection', icon: '⚠️' },
  { id: 'reports',   label: 'Reports & PDFs',     icon: '🖨' },
  { id: 'tips',      label: 'Tips & Troubleshooting', icon: '💡' },
]

export default function HelpPage() {
  const [active, setActive] = useState('overview')

  const scrollTo = (id) => {
    setActive(id)
    document.getElementById('help-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* ── Sidebar nav ── */}
      <div style={{
        width: 220, background: '#fff', borderRight: `1px solid ${BORDER}`,
        padding: '24px 0', position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto', flexShrink: 0,
      }}>
        <div style={{ padding: '0 20px 16px', borderBottom: `1px solid ${BORDER}`, marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginBottom: 4 }}>User Guide</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: NAV }}>Help Centre</div>
        </div>
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => scrollTo(s.id)}
            style={{
              width: '100%', textAlign: 'left', padding: '9px 20px',
              background: active === s.id ? GOLD + '22' : 'transparent',
              border: 'none', borderLeft: active === s.id ? `3px solid ${GOLD}` : '3px solid transparent',
              color: active === s.id ? NAV : '#5a6a82',
              fontSize: 13, fontWeight: active === s.id ? 700 : 400,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <span>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px', maxWidth: 860 }}>

        {/* OVERVIEW */}
        <Section id="overview">
          <H1>Transworld Compliance Operations Portal — User Guide</H1>
          <P>This guide explains how to use the portal for your daily compliance workflow. The portal covers three forms: <strong>F-04</strong> (client trade mandates), <strong>F-05</strong> (daily trade reconciliation), and <strong>F-06</strong> (error trade detection and logging). Each has a dedicated page accessible from the left sidebar.</P>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, margin: '24px 0' }}>
            {[
              { icon: '📋', title: 'F-04', sub: 'Client Trade Mandates', desc: 'Upload the pre-jobbing sheet before or on the day of trading', color: BLUE, bg: BLUE_BG, link: '/f04' },
              { icon: '⚖️', title: 'F-05', sub: 'Daily Reconciliation', desc: 'Upload NaYa execution reports at 5pm or the next morning', color: GREEN, bg: GREEN_BG, link: '/reconcile' },
              { icon: '⚠️', title: 'F-06', sub: 'Error Trade GL', desc: 'Detect and log error trades for NGX Rule 12.2 compliance', color: RED, bg: RED_BG, link: '/f06' },
            ].map(m => (
              <Link key={m.title} to={m.link} style={{ textDecoration: 'none' }}>
                <div style={{ background: m.bg, border: `1.5px solid ${m.color}33`, borderRadius: 10, padding: '16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
                  <div style={{ fontWeight: 700, color: m.color, fontSize: 14 }}>{m.title}</div>
                  <div style={{ fontWeight: 600, color: NAV, fontSize: 12, marginBottom: 4 }}>{m.sub}</div>
                  <div style={{ fontSize: 11.5, color: '#5a6a82', lineHeight: 1.5 }}>{m.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          <CalloutBox color={AMBER} bg={AMBER_BG}>
            <strong>Important:</strong> Always complete F-04 before F-05, and both before F-06 detection, for the same trade date. The portal cross-references them — out-of-order uploads will affect the detection results.
          </CalloutBox>
        </Section>

        {/* DAILY WORKFLOW */}
        <Section id="daily">
          <H1>📅 Your Daily Workflow</H1>
          <P>Here is the sequence you should follow every trading day. Not every step applies every day — for example, if there were no trades, F-05 is still recommended if F-04 was done.</P>

          <div style={{ margin: '20px 0' }}>
            {[
              { time: 'Morning\n(before market open)', steps: ['Check if you have client mandates for today.', 'If yes — go to F-04, upload the pre-jobbing PDF from NaYa.', 'Review and approve the mandate lines.'], color: BLUE, icon: '📋' },
              { time: 'Afternoon\n(5pm or later)', steps: ['Log in to NaYa → Intelligence → Jobbing Book Utilization.', 'Download the available Excel reports (up to 3).', 'Download the Job Orders History as PDF.', 'Go to F-05, upload all files, review and approve.'], color: GREEN, icon: '⚖️' },
              { time: 'After F-05\n(same day or next morning)', steps: ['Go to F-06 → Detect Errors tab.', 'Select the trade date — your F-04 and F-05 will load automatically.', 'Optionally upload the CSD Trade Log for financial impact figures.', 'Run detection. Review findings. Log confirmed errors.'], color: RED, icon: '⚠️' },
            ].map((block, i) => (
              <div key={i} style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ width: 120, flexShrink: 0, textAlign: 'right', fontSize: 11, color: '#6b7280', lineHeight: 1.5, whiteSpace: 'pre-line', paddingTop: 2 }}>
                  {block.time}
                </div>
                <div style={{ width: 2, background: BORDER, flexShrink: 0, borderRadius: 1 }} />
                <div style={{ flex: 1, background: '#fff', border: `1px solid ${BORDER}`, borderLeft: `4px solid ${block.color}`, borderRadius: '0 8px 8px 0', padding: '12px 16px' }}>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>{block.icon}</div>
                  <ol style={{ margin: 0, paddingLeft: 18 }}>
                    {block.steps.map((s, j) => (
                      <li key={j} style={{ fontSize: 13, color: '#374151', marginBottom: 4, lineHeight: 1.6 }}>{s}</li>
                    ))}
                  </ol>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* F-04 */}
        <Section id="f04">
          <H1>📋 F-04 — Client Trade Mandate Import</H1>
          <P>The F-04 form records the client instructions you have received and intend to execute on NGX. You upload the pre-jobbing PDF from NaYa and the portal extracts every line using AI.</P>

          <H2>What you need</H2>
          <ul style={{ paddingLeft: 20, margin: '8px 0 16px' }}>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.6 }}>The "Confirm Jobbing" PDF exported from NaYa TRM for today's date</li>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 1.6 }}>This can be prepared the evening before or the morning of the trade date</li>
          </ul>

          <H2>Step by step</H2>
          <Steps steps={[
            { label: 'Open F-04 Mandate Import from the sidebar', body: 'Click "F-04 Mandate Import" in the left navigation.' },
            { label: 'Upload the PDF', body: 'Drag the pre-jobbing PDF into the upload area, or click to browse and select it. The file name appears in green when ready.' },
            { label: 'Click "Extract Mandate Lines"', body: 'The portal reads the PDF using AI and extracts all mandate lines. This takes about 10–20 seconds.' },
            { label: 'Review the extracted lines', body: 'Check each line against the original PDF. Lines where Jobbed Units < Available Units are highlighted in amber (partial jobs). Click any field to correct it if the AI made an error.' },
            { label: 'Add an approver note if needed', body: 'If anything unusual occurred — such as a client reducing their order after the sheet was prepared — add a brief note before locking.' },
            { label: 'Click "Approve & Lock"', body: 'The mandate is saved permanently and becomes the reference for F-05 reconciliation. You cannot edit it after locking.' },
          ]} />

          <CalloutBox color={BLUE} bg={BLUE_BG}>
            <strong>Tip:</strong> You can upload multiple F-04 sheets per day — for example if you receive additional mandates in the afternoon. Each creates a separate record. Use the Recent F-04 Mandates panel on the right to see all records for the week.
          </CalloutBox>
        </Section>

        {/* F-05 */}
        <Section id="f05">
          <H1>⚖️ F-05 — Daily Trade Reconciliation</H1>
          <P>The F-05 form reconciles what was actually executed on NGX against what was jobbed in NaYa. You download reports from NaYa's Intelligence section and upload them all at once.</P>

          <H2>What you need (from NaYa → Intelligence)</H2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '12px 0 20px' }}>
            {[
              { label: 'Fully Executed', fmt: 'Excel (.xlsx)', color: GREEN, bg: GREEN_BG, note: 'Trades completely filled from the jobbing book' },
              { label: 'Partially Executed', fmt: 'Excel (.xlsx)', color: AMBER, bg: AMBER_BG, note: 'Trades only partially filled — outstanding units remain' },
              { label: 'Executed Not Jobbed', fmt: 'Excel (.xlsx)', color: BLUE, bg: BLUE_BG, note: 'Client self-directed trades via the e-trade portal' },
              { label: 'Job Orders History', fmt: 'PDF', color: RED, bg: RED_BG, note: 'All jobs entered in NaYa, including unexecuted ones' },
            ].map(f => (
              <div key={f.label} style={{ background: f.bg, border: `1px solid ${f.color}33`, borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, color: f.color, fontSize: 12 }}>{f.label}</div>
                <div style={{ fontSize: 11, color: '#374151', background: 'rgba(255,255,255,0.5)', borderRadius: 4, padding: '1px 6px', display: 'inline-block', margin: '2px 0 4px', fontFamily: 'monospace' }}>{f.fmt}</div>
                <div style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.5 }}>{f.note}</div>
              </div>
            ))}
          </div>

          <CalloutBox color={AMBER} bg={AMBER_BG}>
            Download whichever files are available. If a section has no trades that day, the file will not exist — that is normal. You must have at least one file to run F-05.
          </CalloutBox>

          <H2>Step by step</H2>
          <Steps steps={[
            { label: 'Log in to NaYa → Intelligence', body: 'After trading hours (5pm or later), log into NaYa TRM and click Intelligence in the left menu.' },
            { label: 'Download Jobbing Book Utilization reports', body: 'Click "Jobbing Book Utilization". Download all available Excel files (Fully Executed, Partially Executed, Executed Not Jobbed). Download directly — do not open and re-save them as this can corrupt the format.' },
            { label: 'Download Job Orders History', body: 'Still in Intelligence, find Job Orders History and export it as a PDF for today\'s trade date.' },
            { label: 'Upload all files at once in F-05', body: 'Go to F-05 Reconciliation in the portal. Drag all downloaded files — Excel and PDF — into the upload area at the same time. The portal identifies each file automatically by its structure.' },
            { label: 'Review the four sections', body: '✅ Fully Executed — matched from the jobbing book\n⚠️ Partial Fills — trades with outstanding units\n🔵 E-Trade (Not Jobbed) — self-directed portal trades\n🔴 Unexecuted Mandates — jobs entered but never traded on NGX' },
            { label: 'Add explanation for exceptions', body: 'If there are partial fills or unexecuted mandates, the explanation field becomes required. Write a brief factual note — e.g. "Client ADAH LUCY PETER — account issue. Follow-up scheduled for next trading day."' },
            { label: 'Approve & Lock', body: 'Once reviewed, click Approve & Lock. The record is saved and the daily PDF report is ready to print.' },
          ]} />

          <H2>What if there were no trades?</H2>
          <P>If F-04 was done (mandates were jobbed) but nothing executed on NGX, you should still run F-05. Upload the Job Orders History PDF. The portal will show everything as unexecuted and you explain why in the note.</P>
        </Section>

        {/* F-06 */}
        <Section id="f06">
          <H1>⚠️ F-06 — Error Trade Detection & Log</H1>
          <P>The F-06 module automatically detects trading errors by cross-referencing your F-04 and F-05 records, and provides the formal error trade log required by NGX Rule 12.2.</P>

          <H2>What the portal detects automatically</H2>
          <div style={{ margin: '12px 0 20px' }}>
            {[
              { icon: '🔁', type: 'Type 4 — Duplicate Trade', color: RED, bg: RED_BG, desc: 'The same trade appears in both the jobbing channel (Fully Executed) AND the e-trade portal (Executed Not Jobbed) on the same day for the same client and security. This means the trade may have been executed twice.' },
              { icon: '⚠️', type: 'Type 5 — Partial Not Followed Up', color: AMBER, bg: AMBER_BG, desc: 'A partial fill has outstanding units that were not re-jobbed on a subsequent day. The client\'s instruction was only partially fulfilled.' },
              { icon: '❓', type: 'Type 7 — No Mandate on File', color: BLUE, bg: BLUE_BG, desc: 'A trade was executed via the e-trade portal but there is no F-04 mandate in the system for that client and security. Requires confirmation that the client gave a valid instruction.' },
            ].map(d => (
              <div key={d.type} style={{ display: 'flex', gap: 12, marginBottom: 12, background: d.bg, border: `1px solid ${d.color}33`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>{d.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, color: d.color, fontSize: 12, marginBottom: 4 }}>{d.type}</div>
                  <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>{d.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <H2>Step by step</H2>
          <Steps steps={[
            { label: 'Complete F-04 and F-05 first', body: 'Both must be approved and locked for the trade date before running F-06 detection.' },
            { label: 'Go to F-06 → Detect Errors tab', body: 'Click the "🔍 Detect Errors" tab. Select the trade date and click "Load Sessions". The portal finds your approved F-04 and F-05 automatically.' },
            { label: 'Upload the CSD Trade Log (optional)', body: 'Download the CSD Trade Log from the CSCS portal for that date and upload it here. This allows the portal to calculate exact financial impacts and set the NGX urgency level automatically.' },
            { label: 'Click "Run Error Detection"', body: 'The portal cross-references all records and shows any findings.' },
            { label: 'Review each finding', body: 'Click + to expand a finding. If it is a genuine error — click "→ Log as F-06 Error Trade". If it is not an error — click "Dismiss — Not an Error" after confirming.' },
            { label: 'Review and submit the F-06 form', body: 'The form opens pre-filled. Check all fields, especially the financial impact if CSD was not uploaded. Click "Log Error Trade" to save with an automatic reference number (ERR-2026-001 format).' },
          ]} />

          <H2>NGX Reporting Thresholds</H2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, margin: '12px 0' }}>
            {[
              { label: 'Standard', threshold: 'Below ₦50,000', action: 'Internal record only. Head of Operations manages.', color: GREEN, bg: GREEN_BG },
              { label: 'High', threshold: '₦50,000 – ₦499,999', action: 'NGX report required. Compliance Officer within 2 hours.', color: AMBER, bg: AMBER_BG },
              { label: 'Critical', threshold: '₦500,000 and above', action: 'Immediate NGX escalation. MD notification within 1 hour.', color: RED, bg: RED_BG },
            ].map(t => (
              <div key={t.label} style={{ background: t.bg, border: `1.5px solid ${t.color}33`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontWeight: 700, color: t.color, fontSize: 13, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.color, marginBottom: 6 }}>{t.threshold}</div>
                <div style={{ fontSize: 11.5, color: '#374151', lineHeight: 1.5 }}>{t.action}</div>
              </div>
            ))}
          </div>

          <CalloutBox color={RED} bg={RED_BG}>
            <strong>Same-day rule:</strong> Every error trade must be logged on the same day it is discovered. Do not wait until the following day — this is a requirement under NGX Rule 12.2 and the Firm's Error Trade Policy v3.0.
          </CalloutBox>
        </Section>

        {/* REPORTS */}
        <Section id="reports">
          <H1>🖨 Reports & PDFs</H1>
          <P>Every module generates printable PDF reports. These are produced directly in the portal — no separate software needed.</P>

          <H2>F-04 Reports</H2>
          <ul style={{ paddingLeft: 20, margin: '8px 0 20px' }}>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}><strong>Daily mandate report</strong> — Click the 🖨 Print/PDF button on any approved F-04 record. Shows all mandate lines, BUY/SELL counts, partial jobs highlighted, and three signature fields.</li>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}><strong>Weekly/Monthly/Quarterly reports</strong> — Scroll below the upload area on the F-04 page. Select the period type, choose the date range, and click Generate. The report includes a day-by-day summary and full mandate line detail for the period.</li>
          </ul>

          <H2>F-05 Reports</H2>
          <ul style={{ paddingLeft: 20, margin: '8px 0 20px' }}>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}><strong>Daily reconciliation report</strong> — From the session history on the right side of the F-05 page, click any approved session to open it, then click 🖨 Print/PDF. Shows all four sections (executed, partial, e-trade, unexecuted), the exceptions note, and the Head of Operations' explanation.</li>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}><strong>Weekly/Monthly/Quarterly reports</strong> — Below the upload area, select the period and click Generate. Includes day-by-day summary with all section counts and full detail tables.</li>
          </ul>

          <H2>F-06 Reports</H2>
          <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
            <li style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.6 }}><strong>F-06 Error Trade form</strong> — From the Error Trade Log tab, click any entry to open it, then click 🖨 Print/PDF. This is the formal record for each error trade, including root cause, corrective action, client and NGX notification status, and the three-signature certification block.</li>
          </ul>

          <CalloutBox color={BLUE} bg={BLUE_BG}>
            All PDF reports include a running header (firm name, form type, period), page numbers (Page 1 of 2), and a footer (print date, confidential notice). The final page always has three signature lines: Prepared By (Operations), Chief Operations Officer, and Compliance Officer.
          </CalloutBox>
        </Section>

        {/* TIPS */}
        <Section id="tips">
          <H1>💡 Tips & Troubleshooting</H1>

          <H2>Common issues</H2>
          {[
            { q: 'The AI extracted the wrong trade date on F-04', a: 'Click on the Trade Date field at the top of the review screen and type the correct date (YYYY-MM-DD format). Always verify the date before approving.' },
            { q: 'The F-05 upload says it cannot detect the file type', a: 'Make sure you downloaded the Excel files directly from NaYa and did not open and re-save them. Re-saving in Excel can change internal format markers. Also confirm the Job Orders History is a PDF, not Excel.' },
            { q: 'F-06 detection says "No sessions found" for a date', a: 'Both F-04 and F-05 must be approved (Approved & Locked) for that date before F-06 detection can work. Check the F-04 and F-05 history panels to confirm the records are saved and approved.' },
            { q: 'The PDF report shows "Invalid Date"', a: 'This is a date format issue. Contact the administrator — this is a portal bug that needs a fix.' },
            { q: 'I approved the wrong F-04 or F-05 by mistake', a: 'You cannot undo an approval yourself. Contact the portal administrator (Okezie Ofoegbu) to delete the incorrect record and re-enter it.' },
            { q: 'The CSD Trade Log upload in F-06 does not seem to match', a: 'Make sure the CSD file is for the exact same trade date as the F-04 and F-05 you selected. Also confirm you are using the Excel file from CSCS, not a re-saved or modified version.' },
            { q: 'I need to print a report but the PDF is blank', a: 'Some browsers block pop-ups. Allow pop-ups for transworld-compliance.vercel.app in your browser settings, then try the Print/PDF button again.' },
          ].map((item, i) => (
            <details key={i} style={{ marginBottom: 10, background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
              <summary style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: NAV, listStyle: 'none', display: 'flex', justifyContent: 'space-between' }}>
                {item.q}
                <span style={{ color: GOLD, fontSize: 18, fontWeight: 300, flexShrink: 0, marginLeft: 8 }}>+</span>
              </summary>
              <div style={{ padding: '10px 14px 12px', fontSize: 12.5, color: '#374151', lineHeight: 1.7, borderTop: `1px solid ${BORDER}` }}>
                {item.a}
              </div>
            </details>
          ))}

          <H2>Best practices</H2>
          <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
            {[
              'Do F-04 before trading begins. It is the mandate of record — any changes after it is locked cannot be made.',
              'Do F-05 the same evening or first thing the next morning. The longer you wait, the harder it is to explain exceptions.',
              'Run F-06 detection every day, even if you expect no errors. A clean result is still a compliance record.',
              'Upload the CSD Trade Log when running F-06. The automatic financial impact calculation ensures the correct NGX urgency level.',
              'If you are unsure whether something is an error trade, log it and let the Compliance Officer review it. The policy says it is always better to log something that turns out not to be an error than to leave an actual error unlogged.',
              'Keep the portal open in a browser tab throughout the day so you can access it quickly at 5pm.',
            ].map((tip, i) => (
              <li key={i} style={{ fontSize: 13, color: '#374151', marginBottom: 8, lineHeight: 1.7 }}>{tip}</li>
            ))}
          </ul>
        </Section>

        <div style={{ height: 60 }} />
      </div>
    </div>
  )
}

// ── Small layout components ───────────────────────────────────────────────────
function Section({ id, children }) {
  return (
    <section id={'help-' + id} style={{ marginBottom: 48, scrollMarginTop: 20 }}>
      {children}
    </section>
  )
}
function H1({ children }) {
  return <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: NAV, marginBottom: 12, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8 }}>{children}</h2>
}
function H2({ children }) {
  return <h3 style={{ fontSize: 15, fontWeight: 700, color: NAV, marginTop: 20, marginBottom: 10 }}>{children}</h3>
}
function P({ children }) {
  return <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.75, marginBottom: 14 }}>{children}</p>
}
function CalloutBox({ color, bg, children }) {
  return (
    <div style={{ background: bg, borderLeft: `4px solid ${color}`, borderRadius: '0 8px 8px 0', padding: '12px 16px', fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '16px 0' }}>
      {children}
    </div>
  )
}
function Steps({ steps }) {
  return (
    <div style={{ margin: '12px 0' }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 28, height: 28, background: NAV, color: GOLD, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
            {i + 1}
          </div>
          <div style={{ flex: 1, paddingTop: 3 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: NAV, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{s.body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
