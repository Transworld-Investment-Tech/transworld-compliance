import { useState, useRef, useCallback } from "react";
import F04ReportGenerator from "./F04ReportGenerator";
import { HelpButton } from "./HelpSystem";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const NAV = "#0d1f3c";
const GOLD = "#c9a84c";
const GOLD_LIGHT = "#f5e6c0";
const SURFACE = "#f7f8fa";
const BORDER = "#dde1ea";
const RED = "#c0392b";
const GREEN = "#1a7a4a";
const AMBER = "#b45309";

const STATUS_COLORS = {
  draft: { bg: "#fff8e1", text: AMBER, label: "Draft — Pending Review" },
  approved: { bg: "#e8f5e9", text: GREEN, label: "Approved & Locked" },
  reconciled: { bg: "#e3f0ff", text: "#1565c0", label: "Reconciled" },
};

const SIDE_COLORS = {
  SELL: { bg: "#fdecea", text: RED },
  BUY: { bg: "#e8f5e9", text: GREEN },
};

export default function F04PreJobImport({ currentUser }) {
  const [stage, setStage] = useState("upload"); // upload | extracting | review | saving | done
  const [dragOver, setDragOver] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [lines, setLines] = useState([]);
  const [extractionError, setExtractionError] = useState("");
  const [approverNote, setApproverNote] = useState("");
  const [savedMandateId, setSavedMandateId] = useState(null);
  const [existingMandates, setExistingMandates] = useState([]);
  const [viewingMandate, setViewingMandate] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileRef = useRef();

  // ── Load history on mount ───────────────────────────────────────────────
  useState(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("f04_mandates")
      .select("id, trade_date, status, approver_name, approved_at, pdf_name, line_count, created_at, created_by")
      .order("trade_date", { ascending: false })
      .limit(20);
    setExistingMandates(data || []);
    setLoadingHistory(false);
  }

  // ── File handling ───────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    // Accept by MIME type OR .pdf extension — some download paths (e.g. saving
    // from the NaYa print dialog) give the browser an empty MIME type.
    const isPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name || ""));
    if (!isPdf) {
      setExtractionError("Please upload a PDF file.");
      return;
    }
    setPdfFile(file);
    setPdfName(file.name);
    setExtractionError("");
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  // ── AI Extraction ───────────────────────────────────────────────────────
  async function extractFromPDF() {
    if (!pdfFile) return;
    setStage("extracting");
    setExtractionError("");

    try {
      // Convert PDF to base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("Read failed"));
        r.readAsDataURL(pdfFile);
      });

      const systemPrompt = `You are a data extraction assistant for a Nigerian investment securities firm.
You will be given a jobbing sheet PDF from Transworld Investment and Securities.
Extract ALL rows from the jobbing table and return ONLY a JSON object with no preamble, no markdown backticks.

The JSON must have this exact structure:
{
  "trade_date": "YYYY-MM-DD",
  "rows": [
    {
      "cscs_no": "string",
      "client_name": "string",
      "side": "BUY or SELL",
      "symbol": "string (uppercase, e.g. NAHCO, NGXGROUP, ACCESSCORP)",
      "avail_units": number,
      "jobbed_units": number,
      "price_limit": number or null,
      "eff_date": "YYYY-MM-DD",
      "date_limit": "YYYY-MM-DD or null",
      "entered_by": "string",
      "modified_by": "string or null",
      "account_officer": "string or null",
      "exchange": "NGX"
    }
  ]
}

Rules:
- Parse the date from "UNAPPROVED JOBS FOR [date]" at the top for trade_date
- If PriceLimit column is empty or "n/a", set price_limit to null
- If DateLimit is "n/a" or empty, set date_limit to null
- Convert all dates to YYYY-MM-DD format
- symbol must be the NGX ticker in uppercase, no spaces
- side must be exactly "BUY" or "SELL" (uppercase)
- numbers must be plain numbers, no commas or currency symbols
- Do NOT include estimated cost or balance as price_limit`;

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [{
            role: "user",
            content: [{
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 }
            }, {
              type: "text",
              text: "Extract all rows from this jobbing sheet. Return only the JSON object."
            }]
          }]
        })
      });

      const data = await response.json();

      // Surface API errors as readable messages (model retired, key invalid,
      // rate limited, etc.) instead of crashing on a missing content array.
      if (!response.ok || data.error) {
        const raw = data?.error?.message || data?.error || `AI service error (HTTP ${response.status})`;
        throw new Error(typeof raw === "string" ? raw : JSON.stringify(raw));
      }
      if (!Array.isArray(data.content)) {
        throw new Error("AI service returned an unexpected response. Please try again.");
      }

      const rawText = data.content
        .filter(b => b.type === "text")
        .map(b => b.text)
        .join("");

      const clean = rawText.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      setTradeDate(parsed.trade_date || "");
      setLines(parsed.rows.map((r, i) => ({
        ...r,
        _id: i,
        _edited: false,
        _flag: r.avail_units !== r.jobbed_units ? "partial" : null,
      })));
      setStage("review");

    } catch (err) {
      console.error(err);
      setExtractionError("Extraction failed: " + err.message + ". Please check the PDF and try again.");
      setStage("upload");
    }
  }

  // ── Line editing ────────────────────────────────────────────────────────
  function updateLine(id, field, value) {
    setLines(prev => prev.map(l =>
      l._id === id ? { ...l, [field]: value, _edited: true } : l
    ));
  }

  function removeLine(id) {
    setLines(prev => prev.filter(l => l._id !== id));
  }

  function addLine() {
    const newId = Math.max(...lines.map(l => l._id), 0) + 1;
    setLines(prev => [...prev, {
      _id: newId, _edited: true, _flag: null,
      cscs_no: "", client_name: "", side: "SELL", symbol: "",
      avail_units: 0, jobbed_units: 0, price_limit: null,
      eff_date: tradeDate, date_limit: null,
      entered_by: currentUser || "", modified_by: null,
      account_officer: "", exchange: "NGX"
    }]);
  }

  // ── Save & Approve ──────────────────────────────────────────────────────
  async function saveAndApprove() {
    if (!tradeDate) { alert("Trade date is required."); return; }
    if (lines.length === 0) { alert("No mandate lines to save."); return; }

    setStage("saving");

    try {
      // Upload PDF to Supabase Storage
      let pdfUrl = null;
      if (pdfFile) {
        const storagePath = `f04-mandates/${tradeDate}-${Date.now()}.pdf`;
        const { data: storageData } = await supabase.storage
          .from("compliance-docs")
          .upload(storagePath, pdfFile, { contentType: "application/pdf", upsert: false });
        if (storageData) pdfUrl = storagePath;
      }

      // Insert mandate header
      const { data: mandate, error: mandateErr } = await supabase
        .from("f04_mandates")
        .insert({
          trade_date: tradeDate,
          status: "approved",
          approver_name: currentUser || "Admin",
          approver_note: approverNote,
          approved_at: new Date().toISOString(),
          pdf_name: pdfName,
          pdf_url: pdfUrl,
          line_count: lines.length,
          created_by: currentUser || "Admin",
        })
        .select()
        .single();

      if (mandateErr) throw mandateErr;

      // Insert mandate lines
      const lineRows = lines.map(l => ({
        mandate_id: mandate.id,
        cscs_no: l.cscs_no,
        client_name: l.client_name,
        side: l.side,
        symbol: l.symbol,
        avail_units: parseInt(l.avail_units) || 0,
        jobbed_units: parseInt(l.jobbed_units) || 0,
        price_limit: l.price_limit ? parseFloat(l.price_limit) : null,
        eff_date: l.eff_date,
        date_limit: l.date_limit || null,
        entered_by: l.entered_by,
        modified_by: l.modified_by || null,
        account_officer: l.account_officer || null,
        exchange: l.exchange || "NGX",
        partial_flag: l.avail_units !== l.jobbed_units,
      }));

      const { error: linesErr } = await supabase
        .from("f04_mandate_lines")
        .insert(lineRows);

      if (linesErr) throw linesErr;

      setSavedMandateId(mandate.id);
      setStage("done");
      loadHistory();

    } catch (err) {
      console.error(err);
      setExtractionError("Save failed: " + err.message);
      setStage("review");
    }
  }

  function reset() {
    setStage("upload");
    setPdfFile(null);
    setPdfName("");
    setTradeDate("");
    setLines([]);
    setExtractionError("");
    setApproverNote("");
    setSavedMandateId(null);
  }

  // ── View existing mandate ───────────────────────────────────────────────
  async function openMandate(id) {
    const { data: header } = await supabase
      .from("f04_mandates")
      .select("*")
      .eq("id", id)
      .single();
    const { data: lineData } = await supabase
      .from("f04_mandate_lines")
      .select("*")
      .eq("mandate_id", id)
      .order("id");
    setViewingMandate({ ...header, lines: lineData || [] });
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", color: NAV, minHeight: "100vh", background: SURFACE }}>

      {/* Header */}
      <div style={{
        background: NAV, borderBottom: `3px solid ${GOLD}`,
        padding: "20px 32px", display: "flex", alignItems: "center", gap: 16
      }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", marginBottom: 2 }}>
            Form F-04 · Trading Controls
          </div>
          <div style={{ color: "#fff", fontSize: 20, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
            Client Trade Mandate & Order Authorisation
          </div>
          <div style={{ color: "#8fa3c0", fontSize: 12, marginTop: 2 }}>
            Pre-job import · AI extraction · Compliance approval
          </div>
        </div>
        <HelpButton pageKey="f04" style={{ marginLeft: "auto", marginRight: stage !== "upload" && stage !== "extracting" ? 12 : 0 }} />
        {stage !== "upload" && stage !== "extracting" && (
          <button onClick={reset} style={{
            marginLeft: "auto", background: "transparent", border: `1px solid #8fa3c0`,
            color: "#8fa3c0", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12
          }}>
            + New Import
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 0, minHeight: "calc(100vh - 80px)" }}>

        {/* ── Main Panel ── */}
        <div style={{ padding: 32, borderRight: `1px solid ${BORDER}` }}>

          {/* STAGE: Upload */}
          {stage === "upload" && (
            <div>
              <SectionTitle>Import Today's Jobbing Sheet</SectionTitle>
              <p style={{ color: "#5a6a82", fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
                Upload the "Confirm Jobbing" PDF exported from NaYa TRM. The portal will extract all
                mandate lines using AI and present them for your review before locking.
              </p>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current.click()}
                style={{
                  border: `2px dashed ${dragOver ? GOLD : BORDER}`,
                  borderRadius: 12,
                  background: dragOver ? GOLD_LIGHT : "#fff",
                  padding: "48px 32px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: 16,
                }}
              >
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                {pdfFile ? (
                  <div>
                    <div style={{ color: GREEN, fontWeight: 600, fontSize: 14 }}>✓ {pdfName}</div>
                    <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>Click to change file</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 600, color: NAV, fontSize: 14 }}>Drop jobbing sheet PDF here</div>
                    <div style={{ color: "#888", fontSize: 12, marginTop: 6 }}>or click to browse · PDF only</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
                  onChange={e => handleFile(e.target.files[0])} />
              </div>

              {extractionError && (
                <div style={{ background: "#fdecea", border: `1px solid ${RED}`, color: RED, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
                  {extractionError}
                </div>
              )}

              <button
                onClick={extractFromPDF}
                disabled={!pdfFile}
                style={{
                  background: pdfFile ? GOLD : "#ccc",
                  color: pdfFile ? NAV : "#888",
                  border: "none", borderRadius: 8, padding: "12px 28px",
                  fontWeight: 700, fontSize: 14, cursor: pdfFile ? "pointer" : "not-allowed",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  transition: "all 0.2s",
                }}
              >
                Extract Mandate Lines →
              </button>

              {/* ── Period Report Generator ── */}
              <F04ReportGenerator />
            </div>
          )}

          {/* STAGE: Extracting */}
          {stage === "extracting" && (
            <div style={{ textAlign: "center", padding: "80px 32px" }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>⚙️</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 8 }}>
                Extracting mandate lines…
              </div>
              <div style={{ color: "#5a6a82", fontSize: 13 }}>
                Reading {pdfName} · AI is parsing all rows from the jobbing sheet
              </div>
              <div style={{ marginTop: 24 }}>
                <LoadingDots />
              </div>
            </div>
          )}

          {/* STAGE: Saving */}
          {stage === "saving" && (
            <div style={{ textAlign: "center", padding: "80px 32px" }}>
              <div style={{ fontSize: 40, marginBottom: 20 }}>💾</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: NAV, marginBottom: 8 }}>
                Saving approved mandate…
              </div>
              <LoadingDots />
            </div>
          )}

          {/* STAGE: Done */}
          {stage === "done" && (
            <div style={{ textAlign: "center", padding: "80px 32px" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: GREEN, marginBottom: 8, fontFamily: "'Playfair Display', serif" }}>
                F-04 Approved & Locked
              </div>
              <div style={{ color: "#5a6a82", fontSize: 13, marginBottom: 8 }}>
                Trade date: <strong>{tradeDate}</strong> · {lines.length} mandate line{lines.length !== 1 ? "s" : ""} saved
              </div>
              <div style={{ color: "#5a6a82", fontSize: 13, marginBottom: 32 }}>
                Mandate ID: <code style={{ background: "#eee", padding: "2px 6px", borderRadius: 4 }}>{savedMandateId}</code>
              </div>
              <div style={{
                background: "#e8f5e9", border: `1px solid ${GREEN}`, borderRadius: 10,
                padding: "16px 24px", display: "inline-block", textAlign: "left", marginBottom: 32
              }}>
                <div style={{ fontWeight: 700, color: GREEN, fontSize: 13, marginBottom: 6 }}>What happens next</div>
                <div style={{ fontSize: 12, color: "#2d5a3d", lineHeight: 1.8 }}>
                  • This mandate is now locked as your authorised order record<br />
                  • After market close, run reconciliation to compare against NaYa execution logs<br />
                  • Any unmatched trades will auto-flag for F-05 and potential F-06 error trades
                </div>
              </div>
              <div>
                <button onClick={reset} style={{
                  background: GOLD, color: NAV, border: "none", borderRadius: 8,
                  padding: "12px 28px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  fontFamily: "'IBM Plex Sans', sans-serif", marginRight: 12
                }}>
                  Import Another Sheet
                </button>
              </div>
            </div>
          )}

          {/* STAGE: Review */}
          {stage === "review" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
                <div>
                  <SectionTitle>Review Extracted Mandates</SectionTitle>
                  <div style={{ color: "#5a6a82", fontSize: 12 }}>
                    Verify all lines before approving. Edited cells are highlighted. Flagged rows need attention.
                  </div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                  <label style={{ fontSize: 12, color: NAV, fontWeight: 600 }}>Trade Date</label>
                  <input type="date" value={tradeDate} onChange={e => setTradeDate(e.target.value)}
                    style={inputStyle} />
                </div>
              </div>

              {/* Flags summary */}
              {lines.some(l => l._flag) && (
                <div style={{
                  background: "#fff8e1", border: `1px solid ${GOLD}`, borderRadius: 8,
                  padding: "10px 16px", fontSize: 12, color: AMBER, marginBottom: 16,
                  display: "flex", alignItems: "center", gap: 8
                }}>
                  <span>⚠️</span>
                  <span>
                    <strong>{lines.filter(l => l._flag).length} row(s)</strong> have JobbedUnits ≠ AvailUnits (partial jobbing). Add a note or confirm this is intentional before approving.
                  </span>
                </div>
              )}

              {extractionError && (
                <div style={{ background: "#fdecea", border: `1px solid ${RED}`, color: RED, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
                  {extractionError}
                </div>
              )}

              {/* Mandate lines table */}
              <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 20 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: NAV, color: "#fff" }}>
                      {["CSCS No", "Client", "Side", "Symbol", "Avail", "Jobbed", "Price Limit", "Eff Date", "Entered By", "Acct Officer", ""].map(h => (
                        <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => (
                      <tr key={line._id} style={{
                        background: line._flag ? "#fff8e1" : idx % 2 === 0 ? "#fff" : SURFACE,
                        borderBottom: `1px solid ${BORDER}`
                      }}>
                        <td style={tdStyle}>
                          <EditCell value={line.cscs_no} onChange={v => updateLine(line._id, "cscs_no", v)} edited={line._edited} />
                        </td>
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          <EditCell value={line.client_name} onChange={v => updateLine(line._id, "client_name", v)} edited={line._edited} />
                        </td>
                        <td style={tdStyle}>
                          <select value={line.side} onChange={e => updateLine(line._id, "side", e.target.value)}
                            style={{
                              background: SIDE_COLORS[line.side]?.bg || "#eee",
                              color: SIDE_COLORS[line.side]?.text || NAV,
                              border: "none", borderRadius: 4, padding: "3px 6px",
                              fontWeight: 700, fontSize: 11, cursor: "pointer",
                              fontFamily: "'IBM Plex Sans', sans-serif"
                            }}>
                            <option value="SELL">SELL</option>
                            <option value="BUY">BUY</option>
                          </select>
                        </td>
                        <td style={tdStyle}>
                          <EditCell value={line.symbol} onChange={v => updateLine(line._id, "symbol", v.toUpperCase())} edited={line._edited}
                            style={{ fontWeight: 700, fontFamily: "monospace" }} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <EditCell value={line.avail_units} onChange={v => updateLine(line._id, "avail_units", v)} type="number" edited={line._edited} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <EditCell value={line.jobbed_units} onChange={v => updateLine(line._id, "jobbed_units", v)} type="number" edited={line._edited}
                            style={line._flag ? { color: AMBER, fontWeight: 700 } : {}} />
                          {line._flag && <span title="Partial jobbing">⚠️</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <EditCell value={line.price_limit ?? ""} onChange={v => updateLine(line._id, "price_limit", v || null)} type="number" edited={line._edited}
                            placeholder="Market" />
                        </td>
                        <td style={tdStyle}>
                          <EditCell value={line.eff_date} onChange={v => updateLine(line._id, "eff_date", v)} edited={line._edited} />
                        </td>
                        <td style={tdStyle}>
                          <EditCell value={line.entered_by} onChange={v => updateLine(line._id, "entered_by", v)} edited={line._edited} />
                        </td>
                        <td style={tdStyle}>
                          <EditCell value={line.account_officer || ""} onChange={v => updateLine(line._id, "account_officer", v)} edited={line._edited} />
                        </td>
                        <td style={tdStyle}>
                          <button onClick={() => removeLine(line._id)} title="Remove line"
                            style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 14, padding: "2px 4px" }}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button onClick={addLine} style={{
                background: "none", border: `1px dashed ${BORDER}`, color: "#5a6a82",
                borderRadius: 6, padding: "6px 16px", cursor: "pointer", fontSize: 12,
                marginBottom: 28, fontFamily: "'IBM Plex Sans', sans-serif"
              }}>
                + Add line manually
              </button>

              {/* Approval section */}
              <div style={{
                background: "#fff", border: `2px solid ${GOLD}`, borderRadius: 10, padding: "20px 24px"
              }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: NAV, marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>
                  Compliance Approval
                </div>
                <div style={{ fontSize: 12, color: "#5a6a82", marginBottom: 14 }}>
                  By approving, you confirm these mandates are authorised client instructions and may be executed on NGX. This action is recorded with your name and timestamp.
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Approving as
                  </label>
                  <div style={{ fontSize: 13, color: NAV, fontWeight: 700, background: SURFACE, padding: "8px 12px", borderRadius: 6, display: "inline-block" }}>
                    {currentUser || "Current User"}
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Notes (optional — e.g. reason for partial jobbing)
                  </label>
                  <textarea
                    value={approverNote}
                    onChange={e => setApproverNote(e.target.value)}
                    placeholder="Add any notes about this mandate batch…"
                    rows={3}
                    style={{
                      ...inputStyle, width: "100%", resize: "vertical",
                      fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13
                    }}
                  />
                </div>
                <button onClick={saveAndApprove} style={{
                  background: GOLD, color: NAV, border: "none", borderRadius: 8,
                  padding: "12px 32px", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  fontFamily: "'IBM Plex Sans', sans-serif",
                }}>
                  ✓ Approve & Lock Mandate
                </button>
                <span style={{ fontSize: 11, color: "#5a6a82", marginLeft: 12 }}>
                  {lines.length} line{lines.length !== 1 ? "s" : ""} · {tradeDate}
                </span>
              </div>
            </div>
          )}

          {/* View existing mandate */}
          {viewingMandate && (
            <MandateDetailModal mandate={viewingMandate} onClose={() => setViewingMandate(null)} />
          )}
        </div>

        {/* ── Sidebar: History ── */}
        <div style={{ background: "#fff", padding: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Recent F-04 Mandates
          </div>

          {loadingHistory && <div style={{ color: "#aaa", fontSize: 12 }}>Loading…</div>}

          {existingMandates.length === 0 && !loadingHistory && (
            <div style={{ color: "#aaa", fontSize: 12 }}>No mandates yet</div>
          )}

          {existingMandates.map(m => (
            <div key={m.id}
              onClick={() => openMandate(m.id)}
              style={{
                border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 14px",
                marginBottom: 10, cursor: "pointer", transition: "border-color 0.15s",
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = GOLD}
              onMouseOut={e => e.currentTarget.style.borderColor = BORDER}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: NAV }}>
                  {formatDate(m.trade_date)}
                </div>
                <StatusBadge status={m.status} />
              </div>
              <div style={{ fontSize: 11, color: "#5a6a82" }}>
                {m.line_count} line{m.line_count !== 1 ? "s" : ""} · {m.approver_name}
              </div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                {m.pdf_name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EditCell({ value, onChange, type = "text", placeholder = "", edited, style = {} }) {
  return (
    <input
      type={type}
      value={value ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: "none",
        background: edited ? "#fffde7" : "transparent",
        fontFamily: "'IBM Plex Sans', sans-serif",
        fontSize: 12,
        width: "100%",
        padding: "2px 4px",
        borderRadius: 3,
        color: NAV,
        outline: "none",
        ...style
      }}
    />
  );
}

function MandateDetailModal({ mandate, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, width: "90%", maxWidth: 900,
        maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{
          background: NAV, padding: "20px 24px", display: "flex",
          alignItems: "center", justifyContent: "space-between", borderRadius: "12px 12px 0 0"
        }}>
          <div>
            <div style={{ color: GOLD, fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>F-04 Mandate</div>
            <div style={{ color: "#fff", fontSize: 18, fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              {formatDate(mandate.trade_date)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <StatusBadge status={mandate.status} />
            <button onClick={() => printF04Mandate(mandate)} style={{
              background: GOLD, border: "none", color: NAV,
              borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12,
              fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif",
            }}>🖨 Print / PDF</button>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.1)", border: "none", color: "#fff",
              borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12
            }}>Close</button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 24, marginBottom: 20, fontSize: 12, color: "#5a6a82" }}>
            <div><strong>Approver:</strong> {mandate.approver_name}</div>
            <div><strong>Approved:</strong> {mandate.approved_at ? new Date(mandate.approved_at).toLocaleString() : "—"}</div>
            <div><strong>Lines:</strong> {mandate.line_count}</div>
            <div><strong>Source:</strong> {mandate.pdf_name}</div>
          </div>
          {mandate.approver_note && (
            <div style={{ background: GOLD_LIGHT, borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 20, color: NAV }}>
              <strong>Note:</strong> {mandate.approver_note}
            </div>
          )}

          <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: NAV, color: "#fff" }}>
                  {["CSCS No", "Client", "Side", "Symbol", "Avail Units", "Jobbed Units", "Price Limit", "Eff Date", "Entered By", "Acct Officer"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(mandate.lines || []).map((l, i) => (
                  <tr key={l.id} style={{ background: l.partial_flag ? "#fff8e1" : i % 2 === 0 ? "#fff" : SURFACE, borderBottom: `1px solid ${BORDER}` }}>
                    <td style={tdStyle}>{l.cscs_no}</td>
                    <td style={tdStyle}>{l.client_name}</td>
                    <td style={tdStyle}>
                      <span style={{
                        background: SIDE_COLORS[l.side]?.bg, color: SIDE_COLORS[l.side]?.text,
                        fontWeight: 700, borderRadius: 4, padding: "2px 8px", fontSize: 11
                      }}>{l.side}</span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 700, fontFamily: "monospace" }}>{l.symbol}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{l.avail_units?.toLocaleString()}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {l.jobbed_units?.toLocaleString()}
                      {l.partial_flag && <span title="Partial"> ⚠️</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{l.price_limit ?? <span style={{ color: "#aaa" }}>Market</span>}</td>
                    <td style={tdStyle}>{l.eff_date}</td>
                    <td style={tdStyle}>{l.entered_by}</td>
                    <td style={tdStyle}>{l.account_officer || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg: "#eee", text: "#888", label: status };
  return (
    <span style={{
      background: s.bg, color: s.text, borderRadius: 20,
      padding: "3px 10px", fontSize: 10, fontWeight: 700, letterSpacing: 0.5
    }}>
      {s.label}
    </span>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 16, fontFamily: "'Playfair Display', serif",
      fontWeight: 700, color: NAV, marginBottom: 6
    }}>{children}</div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: GOLD,
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0)} 40%{transform:scale(1)} }`}</style>
    </div>
  );
}

const inputStyle = {
  border: `1px solid ${BORDER}`, borderRadius: 6, padding: "7px 10px",
  fontSize: 13, color: NAV, outline: "none",
  fontFamily: "'IBM Plex Sans', sans-serif", background: "#fff",
};

const tdStyle = {
  padding: "8px 10px", verticalAlign: "middle",
};

function formatDate(d) {
  if (!d) return "—";
  const s = String(d);
  // YYYY-MM-DD stored as UTC midnight shifts day back in US/EU timezones — force local noon
  const safe = s.length === 10 ? s + "T12:00:00" : s;
  return new Date(safe).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateLong(d) {
  if (!d) return "—";
  const s = String(d);
  const safe = s.length === 10 ? s + "T12:00:00" : s;
  return new Date(safe).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

// ── F-04 PDF Print ────────────────────────────────────────────────────────────
function printF04Mandate(mandate) {
  if (!mandate) return;
  const now      = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const period   = formatDateLong(mandate.trade_date);
  const approvedAt = mandate.approved_at ? new Date(mandate.approved_at).toLocaleString("en-GB") : "—";

  const lineRows = (mandate.lines || []).map((l, i) => {
    const isPartial = l.partial_flag;
    const sideBg  = l.side === "BUY" ? "#e8f5e9" : "#fdecea";
    const sideClr = l.side === "BUY" ? "#1a7a4a" : "#c0392b";
    const rowBg   = isPartial ? "#fffbeb" : i % 2 === 0 ? "#fff" : "#f9fafb";
    return "<tr style=\"background:" + rowBg + ";border-bottom:1px solid #f0f0f0\">" +
      "<td style=\"padding:4px 7px;font-family:monospace;font-size:8pt\">" + (l.cscs_no || "—") + "</td>" +
      "<td style=\"padding:4px 7px;font-weight:600;font-size:8pt\">" + (l.client_name || "—") + "</td>" +
      "<td style=\"padding:4px 7px\"><span style=\"background:" + sideBg + ";color:" + sideClr + ";font-weight:700;border-radius:4px;padding:1px 7px;font-size:7.5pt\">" + (l.side || "—") + "</span></td>" +
      "<td style=\"padding:4px 7px;font-weight:700;font-family:monospace;font-size:8.5pt\">" + (l.symbol || "—") + "</td>" +
      "<td style=\"padding:4px 7px;text-align:right;font-size:8pt\">" + (l.avail_units != null ? Number(l.avail_units).toLocaleString() : "—") + "</td>" +
      "<td style=\"padding:4px 7px;text-align:right;font-weight:700;font-size:8pt;" + (isPartial ? "color:#b45309" : "") + "\">" + (l.jobbed_units != null ? Number(l.jobbed_units).toLocaleString() : "—") + (isPartial ? " ⚠️" : "") + "</td>" +
      "<td style=\"padding:4px 7px;text-align:right;font-size:8pt\">" + (l.price_limit || "Market") + "</td>" +
      "<td style=\"padding:4px 7px;font-size:8pt\">" + (l.eff_date || "—") + "</td>" +
      "<td style=\"padding:4px 7px;font-size:7.5pt;color:#6b7280\">" + (l.entered_by || "—") + "</td>" +
      "<td style=\"padding:4px 7px;font-size:7.5pt;color:#6b7280\">" + (l.account_officer || "—") + "</td>" +
    "</tr>";
  }).join("");

  const partialCount = (mandate.lines || []).filter(l => l.partial_flag).length;

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; }
    @page {
      size: A4 landscape; margin: 14mm 16mm;
      @top-left   { content: "Transworld Investment and Securities Limited"; font-family: Arial; font-size: 7pt; color: #6b7280; }
      @top-right  { content: "Form F-04 · Client Trade Mandate & Order Authorisation · ${period}"; font-family: Arial; font-size: 7pt; color: #6b7280; }
      @bottom-left   { content: "Confidential — Internal Use Only"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
      @bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: Arial; font-size: 7pt; color: #9ca3af; }
      @bottom-right  { content: "Printed: ${now}"; font-family: Arial; font-size: 7pt; color: #9ca3af; }
    }
    .page { padding: 0; max-width: 100%; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 5px 7px; background: #0d1f3c; color: #fff; text-align: left; font-weight: 600; font-size: 7pt; }
    tr { page-break-inside: avoid; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 6px; }
    .sig-field { border-top: 1px solid #0d1f3c; padding-top: 4px; }
    .sig-label { font-size: 7pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .sig-line { margin-top: 22px; border-bottom: 1px solid #374151; }
    .sig-sub { font-size: 7pt; color: #9ca3af; margin-top: 3px; }
    @media print { body { font-size: 9pt; } }
  `.replace(/\$\{period\}/g, period).replace(/\$\{now\}/g, now);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>F-04 Mandate — ${period}</title>
    <style>${css}</style>
  </head><body>
  <div class="page">
    <div style="border-bottom:3px solid #0d1f3c;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-end">
      <div>
        <div style="font-size:13pt;font-weight:700;color:#0d1f3c">Transworld Investment and Securities Limited</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px">Compliance Operations · Form F-04 · Client Trade Mandate &amp; Order Authorisation</div>
      </div>
      <div style="text-align:right;font-size:8pt;color:#6b7280">Printed: ${now}<br/>Trade Date: ${period}</div>
    </div>

    <div style="font-size:16pt;font-weight:700;color:#0d1f3c;margin-bottom:2px">Client Trade Mandate &amp; Order Authorisation</div>
    <div style="font-size:8.5pt;color:#6b7280;margin-bottom:14px">Trade Date: <strong>${period}</strong></div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;page-break-inside:avoid">
      <div style="border-radius:5px;padding:8px 12px;border:1px solid #e5e7eb;border-left:4px solid #0d1f3c">
        <div style="font-size:20pt;font-weight:700;color:#0d1f3c">${(mandate.lines || []).length}</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase">Total Mandates</div>
      </div>
      <div style="border-radius:5px;padding:8px 12px;border:1px solid #e5e7eb;border-left:4px solid #1a7a4a">
        <div style="font-size:20pt;font-weight:700;color:#1a7a4a">${(mandate.lines || []).filter(l => l.side === "BUY").length}</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase">Buy Orders</div>
      </div>
      <div style="border-radius:5px;padding:8px 12px;border:1px solid #e5e7eb;border-left:4px solid #c0392b">
        <div style="font-size:20pt;font-weight:700;color:#c0392b">${(mandate.lines || []).filter(l => l.side === "SELL").length}</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase">Sell Orders</div>
      </div>
      <div style="border-radius:5px;padding:8px 12px;border:1px solid #e5e7eb;border-left:4px solid #b45309">
        <div style="font-size:20pt;font-weight:700;color:#b45309">${partialCount}</div>
        <div style="font-size:7pt;color:#6b7280;text-transform:uppercase">Partial Jobs ⚠️</div>
      </div>
    </div>

    <div style="display:flex;gap:24px;font-size:8.5pt;color:#374151;margin-bottom:14px;padding:8px 12px;background:#f9fafb;border-radius:6px">
      <span><strong>Approver:</strong> ${mandate.approver_name || "—"}</span>
      <span><strong>Approved:</strong> ${approvedAt}</span>
      <span><strong>Lines:</strong> ${mandate.line_count || (mandate.lines || []).length}</span>
      <span><strong>Source:</strong> ${mandate.pdf_name || "—"}</span>
    </div>

    ${mandate.approver_note ? `<div style="padding:8px 12px;background:#fffbeb;border-left:3px solid #b45309;border-radius:0 5px 5px 0;font-size:8.5pt;color:#374151;margin-bottom:14px"><strong>Note:</strong> ${mandate.approver_note}</div>` : ""}

    <div style="border-radius:5px 5px 0 0;padding:7px 10px;background:#f0f4ff;border:1px solid #c7d2fe;display:flex;align-items:center;gap:8px">
      <span style="font-weight:700;font-size:10pt;color:#1e40af">📋 Mandate Lines</span>
      <span style="margin-left:auto;font-size:8.5pt;font-weight:700;color:#1e40af;padding:1px 9px;background:rgba(255,255,255,0.5);border-radius:20px">${(mandate.lines || []).length} records</span>
    </div>
    <div style="border:1px solid #c7d2fe;border-top:none;border-radius:0 0 5px 5px">
      <table>
        <thead><tr>
          <th>CSCS No</th><th>Client</th><th>Side</th><th>Symbol</th>
          <th style="text-align:right">Avail Units</th><th style="text-align:right">Jobbed Units</th>
          <th style="text-align:right">Price Limit</th><th>Eff Date</th><th>Entered By</th><th>Acct Officer</th>
        </tr></thead>
        <tbody>${lineRows}</tbody>
      </table>
    </div>

    ${partialCount > 0 ? `<div style="margin-top:10px;padding:8px 12px;background:#fffbeb;border-left:3px solid #b45309;border-radius:0 5px 5px 0;font-size:8pt;color:#374151">
      ⚠️ <strong>${partialCount} partial job(s)</strong> — Jobbed Units are less than Available Units. These lines are highlighted in amber above.
    </div>` : ""}

    <div style="margin-top:16px;border:1.5px solid #0d1f3c;border-radius:7px;padding:12px 16px;page-break-inside:avoid">
      <div style="font-weight:700;font-size:10pt;color:#0d1f3c;margin-bottom:6px">Compliance Certification</div>
      <div style="font-size:8pt;color:#374151;line-height:1.65;margin-bottom:14px">
        I confirm that this Client Trade Mandate &amp; Order Authorisation for <strong>${period}</strong> is accurate and complete.
        All client instructions listed above have been reviewed, verified and authorised for execution on NGX.
        This document serves as the pre-job mandate record in accordance with the Firm's Internal Control Framework — Section 5a (Trading Controls).
      </div>
      <div class="sig-row">
        <div class="sig-field"><div class="sig-label">Prepared By (Operations)</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Chief Operations Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
        <div class="sig-field"><div class="sig-label">Compliance Officer</div><div class="sig-line"></div><div class="sig-sub">Signature &amp; Date</div></div>
      </div>
    </div>

    <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:7px;display:flex;justify-content:space-between;font-size:7pt;color:#9ca3af">
      <div>Transworld Investment and Securities Limited — F-04 Client Trade Mandate · ${period}</div>
      <div>Session: ${mandate.id} · Confidential</div>
    </div>
  </div>
  </body></html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  w.onload = () => { setTimeout(() => w.print(), 400); };
}
