import { useState } from 'react'

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

// ── Help content per page ─────────────────────────────────────────────────────
const HELP_CONTENT = {

  f04: {
    title: 'F-04 — Client Trade Mandate Import',
    subtitle: 'Upload the pre-jobbing sheet before or on the day of trading',
    color: BLUE,
    bg: BLUE_BG,
    icon: '📋',
    overview: `The F-04 form records every client instruction you have received and intend to execute on NGX. You upload the pre-jobbing PDF that NaYa generates, the portal reads it using AI, and you review and approve the mandate lines before trading begins.`,
    steps: [
      {
        n: '1', label: 'Get the PDF from NaYa',
        body: `In NaYa TRM, go to the Jobbing Book and export the "Confirm Jobbing" PDF for today's date. This is the pre-jobbing sheet that lists all client mandates pending execution. It can be prepared the evening before or on the morning of the trade date.`,
        tip: null,
      },
      {
        n: '2', label: 'Upload the PDF',
        body: `Drag the PDF into the upload area on this page, or click to browse and select it. The file name will appear in green when it is ready.`,
        tip: 'Only PDF files are accepted here. If you have an Excel version, convert it to PDF first.',
      },
      {
        n: '3', label: 'Click "Extract Mandate Lines"',
        body: `The portal sends the PDF to the AI and extracts every mandate line — client name, CSCS number, security, side (BUY/SELL), available units, jobbed units, and price limit. This takes about 10–20 seconds.`,
        tip: null,
      },
      {
        n: '4', label: 'Review the extracted lines',
        body: `Check each line against the original PDF. Lines where Jobbed Units are less than Available Units are highlighted in amber — these are partial jobs and are flagged automatically. You can edit any field by clicking on it if the AI made a reading error.`,
        tip: 'Always check the Trade Date at the top. Correct it if the AI mis-read it.',
      },
      {
        n: '5', label: 'Add an approver note (if needed)',
        body: `If anything unusual occurred — for example, a client called to reduce their order after the sheet was prepared — add a brief note in the approver note box before locking.`,
        tip: null,
      },
      {
        n: '6', label: 'Click "Approve & Lock"',
        body: `Once you are satisfied the lines are correct, click Approve & Lock. The mandate is saved permanently and becomes the reference against which the F-05 reconciliation will be checked. You cannot edit it after locking.`,
        tip: 'If you made a mistake after locking, contact the administrator. Do not upload the same sheet again.',
      },
    ],
    faqs: [
      { q: 'What if the AI misreads a client name?', a: 'Click on the field in the review table and type the correct value. All fields are editable before you lock.' },
      { q: 'Can I upload more than one sheet per day?', a: 'Yes — for example if you receive additional mandates in the afternoon. Each upload creates a separate F-04 record. You can view all of them in the Recent F-04 Mandates panel on the right.' },
      { q: 'What does the amber row highlight mean?', a: 'It means the Jobbed Units are less than the Available Units — a partial job. This is normal but is flagged so you can review it.' },
      { q: 'Do I need to do F-04 if there are no mandates that day?', a: 'No. Only create an F-04 if clients have given you trade instructions for that day.' },
    ],
  },

  f05: {
    title: 'F-05 — Daily Trade Reconciliation',
    subtitle: 'Upload the NaYa execution reports at 5pm or next morning',
    color: GREEN,
    bg: GREEN_BG,
    icon: '⚖️',
    overview: `The F-05 form reconciles what was executed on NGX against what was jobbed in NaYa. You download up to four Excel and PDF reports from NaYa's Intelligence section, upload them all at once, and the portal automatically categorises them — fully executed, partial fills, e-trade (self-directed), and unexecuted mandates.`,
    steps: [
      {
        n: '1', label: 'Log in to NaYa and go to Intelligence',
        body: `In NaYa TRM, click on the Intelligence section in the left menu. This is where all the post-trade reports for the day are available.`,
        tip: 'Do this at 5pm on the trade date, or first thing the following morning. The reports are not available until execution is complete.',
      },
      {
        n: '2', label: 'Download the Jobbing Book Utilization reports',
        body: `Under Intelligence, click "Jobbing Book Utilization". You will see up to three separate Excel files available for download:\n\n• Fully Executed — trades that were completely filled\n• Partially Executed — trades that were only partially filled\n• Executed Not Jobbed — trades that went through the e-trade portal (self-directed by the client)\n\nDownload whichever of these three files are available. If a particular category has no trades that day, the file will not be there — that is normal.`,
        tip: 'Download all three as Excel (.xlsx) files. Do not open and re-save them — this can change the format.',
      },
      {
        n: '3', label: 'Download the Job Orders History report',
        body: `Still in Intelligence, find the "Job Orders History" section and export it as a PDF for the same trade date. This report lists every job that was entered into NaYa — including jobs that were entered but never executed on NGX. The portal uses this to detect unexecuted mandates.`,
        tip: 'The Job Orders History must be a PDF. The Jobbing Utilization files must be Excel.',
      },
      {
        n: '4', label: 'Upload all files at once',
        body: `Go to the F-05 Reconciliation page in the portal. Drag all the files you downloaded — the Excel files and the PDF — into the upload area at the same time. The portal will automatically identify which file is which based on its structure. You do not need to label them.`,
        tip: 'Select all files together in one drag or one file picker selection. The portal handles the rest.',
      },
      {
        n: '5', label: 'Review the four sections',
        body: `The portal will display four sections:\n\n✅ Fully Executed — trades matched from the jobbing book\n⚠️ Partial Fills — trades with outstanding units\n🔵 E-Trade (Not Jobbed) — self-directed client trades\n🔴 Unexecuted Mandates — jobs entered but never traded on NGX\n\nReview each section for accuracy.`,
        tip: null,
      },
      {
        n: '6', label: 'Add explanation if there are exceptions',
        body: `If there are partial fills or unexecuted mandates, the "Explanation for exceptions" field becomes required before you can approve. Write a brief factual note explaining why the exception occurred — for example: "Client ADAH LUCY PETER — all sell orders expired same day. Account issue prevents execution. Follow-up scheduled."`,
        tip: 'Be specific. This note appears on the PDF report and in the F-06 detection module.',
      },
      {
        n: '7', label: 'Click "Approve & Lock"',
        body: `Once reviewed and annotated, approve the reconciliation. It is permanently saved and the daily PDF report becomes available. You can also run the period reports (weekly, monthly, quarterly) from the same page.`,
        tip: null,
      },
    ],
    faqs: [
      { q: 'What if there were no trades at all that day?', a: 'If F-04 was done (mandates were jobbed) but nothing executed, you should still run F-05. Upload the Job Orders History PDF — the portal will show everything as unexecuted and you explain why.' },
      { q: 'What if only e-trade trades happened (no jobbing)?', a: 'Upload only the Executed Not Jobbed file. The other sections will show as empty — that is correct.' },
      { q: 'The portal says it cannot detect the file type. What do I do?', a: 'Make sure you downloaded the Excel files directly from NaYa and did not re-save them. Also confirm the Job Orders History is a PDF, not an Excel file.' },
      { q: 'Should I run F-05 even if F-04 was not done?', a: 'Yes, if any trades occurred on NGX that day — including self-directed e-trades — F-05 must be run for the record to be complete.' },
      { q: 'What does "Unexecuted" mean?', a: 'It means a job order was entered in NaYa and approved, but the trade never actually went through on NGX — perhaps because the market price never reached the limit, or the order expired. These must be explained in the note.' },
    ],
  },

  f06: {
    title: 'F-06 — Error Trade Detection & Log',
    subtitle: 'Detect trade errors and log them for compliance',
    color: RED,
    bg: RED_BG,
    icon: '⚠️',
    overview: `The F-06 module does two things: it automatically cross-references your F-04 and F-05 data to detect potential trading errors, and it provides a formal error trade log required by NGX Rule 12.2. The Detect Errors tab is your starting point after completing F-04 and F-05 for a day.`,
    steps: [
      {
        n: '1', label: 'Complete F-04 and F-05 first',
        body: `F-06 detection works by comparing your approved F-04 mandate records against the F-05 execution records. Both must be approved and locked before you run detection for that date.`,
        tip: 'Detection only works for dates where both F-04 and F-05 are already in the system.',
      },
      {
        n: '2', label: 'Go to the Detect Errors tab',
        body: `Click the "🔍 Detect Errors" tab at the top of the F-06 page. Select the trade date you want to analyse. Click "Load Sessions" — the portal will find your approved F-04 and F-05 records for that day automatically.`,
        tip: null,
      },
      {
        n: '3', label: 'Select the F-04 and F-05 sessions',
        body: `The portal will show the approved records it found. If there is only one F-04 and one F-05 for that date, they will be selected automatically. If there are multiple, click to select the correct ones.`,
        tip: null,
      },
      {
        n: '4', label: 'Upload the CSD Trade Log (optional but recommended)',
        body: `Download the CSD Trade Log from the CSCS portal for that date and upload it here. This is the settlement confirmation file. Without it, the portal can still detect errors but cannot calculate the financial impact. With it, financial impacts are calculated automatically and the NGX urgency level (Standard / High / Critical) is set for you.`,
        tip: 'The CSD Trade Log is an Excel file from the CSCS portal. It contains the actual execution prices and settlement amounts.',
      },
      {
        n: '5', label: 'Click "Run Error Detection"',
        body: `The portal checks for three types of errors:\n\n🔁 Duplicate trades — the same trade appearing in both the jobbing channel and the e-trade portal on the same day\n⚠️ Partial fills not followed up — where outstanding units were never re-jobbed\n❓ E-trade with no mandate — trades executed via the portal with no written F-04 mandate on file\n\nAny findings are shown with a suggested description, root cause, and corrective action.`,
        tip: null,
      },
      {
        n: '6', label: 'Review each finding',
        body: `Click the + on any finding to expand it. Review the suggested error description and corrective action. If it is a genuine error, click "→ Log as F-06 Error Trade" — the form will open pre-filled with everything known. If it is not an error (for example, a self-directed trade you can confirm was authorised), click "Dismiss — Not an Error".`,
        tip: 'You must review every finding before you can consider the day complete. Do not dismiss findings without confirming they are not errors.',
      },
      {
        n: '7', label: 'Review and submit the F-06 form',
        body: `The pre-filled F-06 form will open. Check all the fields — especially the financial impact figure if the CSD was not uploaded. Complete any missing fields, then click "Log Error Trade". The error is assigned a reference number (ERR-2026-001 format) and saved permanently.`,
        tip: 'Every error trade must be logged on the same day it is discovered. Do not wait.',
      },
    ],
    faqs: [
      { q: 'What is the NGX Rule 12.2 threshold?', a: 'Any single error trade with a financial impact above ₦50,000 must be reported to NGX Regulation. If the total for the week exceeds ₦500,000, an additional weekly report is required. The portal tracks both automatically.' },
      { q: 'What if I cannot find the CSD Trade Log?', a: 'You can still run detection and log errors without it. Manually enter the financial impact figure in the F-06 form based on the execution price from NaYa or your contract notes.' },
      { q: 'What if there are no errors detected?', a: 'A clean result — "No error candidates detected" — is the expected and desirable outcome. No further action is needed for F-06 on that date.' },
      { q: 'Who needs to sign off on the F-06 form?', a: 'You prepare and submit it. The Compliance Officer (Clement Oladele) must review and sign off each entry before it is considered closed. He will see a "Sign Off & Close" button on each open entry.' },
      { q: 'Can I log an error manually without running detection?', a: 'Yes — use the "+ Log Manually" tab on the F-06 page. This is for errors identified through other means — client calls, settlement discrepancies, or your own review.' },
    ],
  },

  dashboard: {
    title: 'Dashboard',
    subtitle: 'Your daily compliance overview',
    color: NAV,
    bg: '#f0f4ff',
    icon: '⬛',
    overview: `The dashboard gives you a quick summary of this week's activity and quick access to each compliance module. Start here every morning.`,
    steps: [
      { n: '1', label: 'Check the stat cards', body: `The top row shows how many F-04 mandates have been approved this week and when the last one was. This gives you a quick check that yesterday's F-04 was recorded.`, tip: null },
      { n: '2', label: 'Start your daily workflow', body: `Each day typically follows this order:\n\n1. F-04 — upload the pre-jobbing sheet (morning, before trading)\n2. F-05 — upload the execution reports (5pm or next morning)\n3. F-06 — run error detection after F-04 and F-05 are done`, tip: null },
    ],
    faqs: [
      { q: 'What order should I do things each day?', a: 'F-04 first (before or on the morning of the trade date), then F-05 (at 5pm or the next morning after execution), then F-06 detection (after both F-04 and F-05 are approved for that date).' },
    ],
  },
}

// ── HelpButton — the ? button shown on each page ──────────────────────────────
export function HelpButton({ pageKey, style }) {
  const [open, setOpen] = useState(false)
  const content = HELP_CONTENT[pageKey]
  if (!content) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Help & Guide"
        style={{
          background: GOLD, color: NAV, border: 'none', borderRadius: '50%',
          width: 36, height: 36, fontSize: 16, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, boxShadow: '0 2px 8px rgba(201,168,76,0.4)',
          flexShrink: 0,
          ...style,
        }}>
        ?
      </button>

      {open && <HelpDrawer content={content} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── HelpDrawer — slides in from the right ─────────────────────────────────────
function HelpDrawer({ content, onClose }) {
  const [tab, setTab] = useState('steps')

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100 }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 460,
        background: '#fff', zIndex: 1101, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.2)',
        fontFamily: "'IBM Plex Sans', sans-serif",
        animation: 'slideIn 0.2s ease-out',
      }}>

        {/* Header */}
        <div style={{ background: NAV, padding: '20px 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                {content.icon} Help & Guide
              </div>
              <div style={{ color: '#fff', fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>
                {content.title}
              </div>
              <div style={{ color: '#8fa3c0', fontSize: 12, marginTop: 3 }}>{content.subtitle}</div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
            {[{ key: 'steps', label: 'Step-by-Step' }, { key: 'faqs', label: 'FAQs' }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  background: tab === t.key ? '#fff' : 'transparent',
                  color: tab === t.key ? NAV : 'rgba(255,255,255,0.6)',
                  border: 'none', borderRadius: '6px 6px 0 0', padding: '7px 16px',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {tab === 'steps' && (
            <>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginBottom: 20, background: content.bg, borderRadius: 8, padding: '12px 14px', borderLeft: `3px solid ${content.color}` }}>
                {content.overview}
              </div>

              {content.steps.map(step => (
                <div key={step.n} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 28, height: 28, background: NAV, color: GOLD,
                      borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                    }}>
                      {step.n}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: NAV, marginBottom: 5 }}>
                        {step.label}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
                        {step.body}
                      </div>
                      {step.tip && (
                        <div style={{ marginTop: 8, background: AMBER_BG, borderLeft: `3px solid ${AMBER}`, borderRadius: '0 5px 5px 0', padding: '7px 10px', fontSize: 11.5, color: AMBER, lineHeight: 1.6 }}>
                          💡 {step.tip}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'faqs' && (
            <div>
              {content.faqs.map((faq, i) => (
                <details key={i} style={{ marginBottom: 12, background: SURFACE, borderRadius: 8, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
                  <summary style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: NAV, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {faq.q}
                    <span style={{ color: GOLD, fontSize: 18, fontWeight: 300 }}>+</span>
                  </summary>
                  <div style={{ padding: '0 14px 12px', fontSize: 12.5, color: '#374151', lineHeight: 1.7, borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>Need more help?</span>
          <a href="/help" style={{ fontSize: 12, color: BLUE, fontWeight: 600, textDecoration: 'none' }}>
            Open full guide →
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </>
  )
}
