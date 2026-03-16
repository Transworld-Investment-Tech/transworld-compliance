import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import {
  dbLoadAll, dbAddSignoff, dbAddSubmission, dbUpdateSubmission,
  dbUpdateUser, dbAddPolicy, dbUpsertWorkflow, dbAddUser,
  dbUploadPolicyFile, dbArchivePolicy, dbNewVersion,
  dbEditUser, dbDeleteUser, dbResetPassword,
  dbArchiveForm, dbRestoreForm, dbLoadFormConfigs, dbRerouteSubmission,
  dbSetFormPublic, dbLoadForms, dbSeedForms,
  dbSetLineManager, dbLoadDoaConfig, dbSaveDoaConfig, dbUpdateSubmissionFull,
  dbUploadFormAttachment,
} from './supabase.js';
import FormBuilder from './FormBuilder.jsx';

// ── Constants ──────────────────────────────────────────────────────────────────
const NAV  = '#0d1f3c';
const GOLD = '#c9a84c';

const FREQ_CLR = {
  'Daily':'#dc2626','Weekly':'#d97706','Monthly':'#2563eb','Quarterly':'#7c3aed',
  'Annual':'#059669','Per trade':'#0891b2','Per payment':'#0891b2',
  'Per event / Annual':'#059669','Per account / Annual':'#059669',
  'Per error / Weekly review':'#d97706','Monthly till closed':'#2563eb',
  'Monthly / Quarterly':'#7c3aed','As required':'#6b7280',
  'Continuous':'#dc2626','Per meeting':'#0891b2',
};

const WF_STATUS = {
  pending_l1:  { label:'Awaiting L1 Review',   color:'#d97706', bg:'#fef3c7' },
  pending_l2:  { label:'Awaiting L2 Approval', color:'#2563eb', bg:'#dbeafe' },
  pending_doa: { label:'Pending Approval',      color:'#7c3aed', bg:'#ede9fe' },
  approved:    { label:'Fully Approved',        color:'#059669', bg:'#d1fae5' },
  rejected:    { label:'Rejected',              color:'#dc2626', bg:'#fee2e2' },
  no_workflow: { label:'Submitted',             color:'#6b7280', bg:'#f3f4f6' },
};

const FORMS = [
  { ref:'F-01', title:'Code of Ethics Annual Acknowledgement', freq:'Annual', section:'Section 3 — Control Environment', owner:'Compliance Officer', fields:[
    {id:'fullName',label:'Full Name',type:'text',req:true},{id:'jobTitle',label:'Role / Job Title',type:'text',req:true},{id:'dept',label:'Department',type:'text',req:true},{id:'dateAck',label:'Date of Acknowledgement',type:'date',req:true},
    {id:'ck1',label:"I am aware of the firm's policies on conflicts of interest, confidentiality, client priority, and insider trading.",type:'checkbox',req:true},
    {id:'ck2',label:'I have not engaged in and will not engage in any conduct that constitutes market manipulation or front-running.',type:'checkbox',req:true},
    {id:'ck3',label:'I will disclose any potential conflict of interest to the Compliance Officer before undertaking the relevant transaction.',type:'checkbox',req:true},
    {id:'ck4',label:'I understand that breaches of this Code may result in disciplinary action up to and including termination.',type:'checkbox',req:true},
    {id:'sig',label:'Electronic Signature (type full name)',type:'text',req:true},
  ]},
  { ref:'F-02', title:'Conflict of Interest Disclosure Form', freq:'Per event / Annual', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'staffName',label:'Staff Name',type:'text',req:true},{id:'dept',label:'Department',type:'text',req:true},{id:'discDate',label:'Disclosure Date',type:'date',req:true},
    {id:'nature',label:'Nature of Conflict',type:'textarea',req:true},{id:'parties',label:'Parties Involved',type:'textarea',req:true},
    {id:'finInt',label:'Financial Interest Involved?',type:'select',options:['Yes','No'],req:true},{id:'action',label:'Action Taken / Proposed',type:'textarea',req:true},
    {id:'supervisor',label:'Supervisor Name',type:'text',req:true},{id:'sig',label:'Electronic Signature',type:'text',req:true},
  ]},
  { ref:'F-03', title:'Enterprise Risk Register', freq:'Quarterly', section:'Section 4 — Risk Assessment', owner:'Internal Control Officer', fields:[
    {id:'period',label:'Review Period (Quarter/Year)',type:'text',req:true,ph:'e.g. Q1 2026'},{id:'prepBy',label:'Prepared By',type:'text',req:true},{id:'revBy',label:'Reviewed By',type:'text',req:true},
    {id:'narrative',label:'Narrative / Key Changes This Quarter',type:'textarea',req:true},{id:'escalations',label:'Risks Escalated to Board? (List or N/A)',type:'textarea',req:true},{id:'sig',label:'Electronic Signature',type:'text',req:true},
  ]},
  { ref:'F-04', title:'Client Trade Mandate and Order Authorization', freq:'Per trade', section:'Section 5a — Trading Controls', owner:'Operations', fields:[
    {id:'clientName',label:'Client Name',type:'text',req:true},{id:'accountNo',label:'Account Number',type:'text',req:true},{id:'tradeDate',label:'Trade Date',type:'date',req:true},
    {id:'security',label:'Security / Instrument',type:'text',req:true},{id:'tradeType',label:'Trade Type',type:'select',options:['Buy','Sell'],req:true},
    {id:'quantity',label:'Quantity (Units)',type:'number',req:true},{id:'price',label:'Limit Price / Market',type:'text',req:true},{id:'totalVal',label:'Total Estimated Value (NGN)',type:'number',req:true},
    {id:'mandate',label:'Mandate Method',type:'select',options:['Written','Electronic','Phone (recorded)','Portal'],req:true},{id:'authOfficer',label:'Authorizing Officer',type:'text',req:true},{id:'sig',label:'Electronic Signature',type:'text',req:true},
  ]},
  { ref:'F-05', title:'Daily Trade Reconciliation Report', freq:'Daily', section:'Section 5a — Trading Controls', owner:'Operations', fields:[
    {id:'reportDate',label:'Report Date',type:'date',req:true},{id:'prepBy',label:'Prepared By',type:'text',req:true},
    {id:'ngxCount',label:'NGX Trades Executed (Count)',type:'number',req:true},{id:'cscsCount',label:'CSCS Confirmations Received (Count)',type:'number',req:true},
    {id:'discrepancies',label:'Discrepancies Identified',type:'textarea',req:true,ph:"State 'None' if no discrepancies"},
    {id:'resolution',label:'Resolution Status',type:'select',options:['All Reconciled','Items Pending','Escalated'],req:true},{id:'supSig',label:'Supervisor Signature',type:'text',req:true},
  ]},
  { ref:'F-06', title:'Error Trade GL Recording Form', freq:'Per error / Weekly review', section:'Section 5a — Trading Controls', owner:'Finance / Operations', fields:[
    {id:'weekEnd',label:'Week Ending Date',type:'date',req:true},{id:'entryDate',label:'Entry Date',type:'date',req:true},{id:'tradeRef',label:'Trade Reference',type:'text',req:true},
    {id:'errorDesc',label:'Error Description',type:'textarea',req:true},{id:'glAccount',label:'GL Account Debited',type:'text',req:true},{id:'glAmount',label:'GL Amount (NGN)',type:'number',req:true},
    {id:'correction',label:'Correction Entry Posted?',type:'select',options:['Yes','No — Pending'],req:true},{id:'finSig',label:'Finance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-07', title:'Monthly Bank Reconciliation Statement', freq:'Monthly', section:'Section 5b — Financial Controls', owner:'Finance Officer', fields:[
    {id:'month',label:'Month / Year',type:'text',req:true,ph:'e.g. March 2026'},{id:'bankName',label:'Bank Name',type:'text',req:true},{id:'accountNo',label:'Account Number',type:'text',req:true},
    {id:'bankBal',label:'Bank Statement Closing Balance (NGN)',type:'number',req:true},{id:'glBal',label:'GL / Book Balance (NGN)',type:'number',req:true},
    {id:'reconBal',label:'Reconciled Balance (NGN)',type:'number',req:true},{id:'discrepancy',label:'Unexplained Discrepancy (NGN, enter 0 if none)',type:'number',req:true},
    {id:'notes',label:'Notes / Action Items',type:'textarea',req:false},{id:'finSig',label:'Finance Officer Signature',type:'text',req:true},{id:'mdSig',label:'MD Review Signature',type:'text',req:true},
  ]},
  { ref:'F-08', title:'Payment Approval and Disbursement Form', freq:'Per payment', section:'Section 5b — Financial Controls', owner:'Finance Officer', fields:[
    {id:'payDate',label:'Payment Date',type:'date',req:true},{id:'payee',label:'Payee Name',type:'text',req:true},{id:'payeeAcct',label:'Payee Account / Bank Details',type:'text',req:true},
    {id:'amount',label:'Amount (NGN)',type:'number',req:true},{id:'purpose',label:'Purpose / Description',type:'textarea',req:true},{id:'budgetLine',label:'Budget Line Item',type:'text',req:true},
    {id:'docs',label:'Supporting Documents',type:'select',options:['Invoice','Contract','Board Resolution','Other'],req:true},
    {id:'reqBy',label:'Requested By',type:'text',req:true},{id:'finApproval',label:'Finance Officer Approval',type:'text',req:true},{id:'mdApproval',label:'MD Approval',type:'text',req:true},
  ]},
  { ref:'F-09', title:'KYC / AML Account Opening Checklist', freq:'Per account / Annual', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'clientName',label:'Client Name',type:'text',req:true},{id:'acctType',label:'Account Type',type:'select',options:['Individual','Corporate','Trust'],req:true},{id:'openDate',label:'Account Opening Date',type:'date',req:true},
    {id:'ck_id',label:'Government-issued ID verified',type:'checkbox',req:true},{id:'ck_bvn',label:'BVN verified against NIBSS',type:'checkbox',req:true},{id:'ck_addr',label:'Proof of address verified',type:'checkbox',req:true},
    {id:'ck_pep',label:'PEP screening completed',type:'checkbox',req:true},{id:'ck_sanc',label:'Sanctions list check completed',type:'checkbox',req:true},{id:'ck_src',label:'Source of funds documented',type:'checkbox',req:true},
    {id:'riskRating',label:'AML Risk Rating',type:'select',options:['Low','Medium','High'],req:true},{id:'edd',label:'Enhanced Due Diligence Required?',type:'select',options:['Yes — completed','No'],req:true},
    {id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-10', title:'Currency Transaction Report (CTR) Log', freq:'Weekly', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'weekEnd',label:'Week Ending Date',type:'date',req:true},{id:'ctrRef',label:'CTR Reference Number',type:'text',req:true},{id:'txDate',label:'Transaction Date',type:'date',req:true},
    {id:'clientName',label:'Client Name',type:'text',req:true},{id:'amount',label:'Transaction Amount (NGN)',type:'number',req:true},
    {id:'txType',label:'Transaction Type',type:'select',options:['Cash Deposit','Cash Withdrawal','Wire Transfer','Other'],req:true},
    {id:'nfiu',label:'Filed with NFIU?',type:'select',options:['Yes','No — Pending'],req:true},{id:'filingDate',label:'NFIU Filing Date',type:'date',req:false},
    {id:'notes',label:'Notes',type:'textarea',req:false},{id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-11', title:'Suspicious Transaction Report (STR) Log', freq:'As required', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'reportDate',label:'Report Date',type:'date',req:true},{id:'strRef',label:'STR Internal Reference',type:'text',req:true},{id:'clientName',label:'Client / Entity Name',type:'text',req:true},
    {id:'suspicion',label:'Basis for Suspicion',type:'textarea',req:true},{id:'txDetails',label:'Transaction Details',type:'textarea',req:true},
    {id:'nfiu',label:'Filed with NFIU?',type:'select',options:['Yes','No — Pending'],req:true},{id:'action',label:'Internal Action Taken',type:'textarea',req:true},
    {id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},{id:'mdSig',label:'MD Signature',type:'text',req:true},
  ]},
  { ref:'F-12', title:'AML / CFT / CPF Staff Training Register', freq:'Annual', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'trainYear',label:'Training Year',type:'text',req:true},{id:'trainDate',label:'Training Date(s)',type:'text',req:true},{id:'provider',label:'Training Provider / Facilitator',type:'text',req:true},
    {id:'mode',label:'Mode of Training',type:'select',options:['In-person','Online','Hybrid'],req:true},{id:'staffName',label:'Staff Member Name',type:'text',req:true},{id:'dept',label:'Department',type:'text',req:true},
    {id:'attended',label:'Attended?',type:'select',options:['Yes','No — excused','No — unexcused'],req:true},{id:'passed',label:'Assessment Passed?',type:'select',options:['Yes','No','N/A'],req:true},
    {id:'certRef',label:'Certificate Reference',type:'text',req:false},{id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-13', title:'Regulatory Filing Calendar and Compliance Tracker', freq:'Monthly', section:'Section 5c — Compliance Controls', owner:'Compliance Officer', fields:[
    {id:'month',label:'Month / Year',type:'text',req:true},{id:'filingName',label:'Filing / Return Name',type:'text',req:true},{id:'regulator',label:'Regulator / Authority',type:'text',req:true},
    {id:'dueDate',label:'Due Date',type:'date',req:true},{id:'subDate',label:'Actual Submission Date',type:'date',req:false},
    {id:'status',label:'Status',type:'select',options:['Submitted On Time','Submitted Late','Pending','Escalated'],req:true},
    {id:'penalty',label:'Penalty Incurred?',type:'select',options:['Yes — see notes','No'],req:true},{id:'notes',label:'Notes',type:'textarea',req:false},{id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-14', title:'IT User Access Matrix and Re-certification', freq:'Quarterly', section:'Section 5d — IT Controls', owner:'IT / Managing Director', fields:[
    {id:'period',label:'Review Period (Quarter/Year)',type:'text',req:true},{id:'staffName',label:'Staff Name',type:'text',req:true},{id:'role',label:'Role',type:'text',req:true},
    {id:'tradingAccess',label:'Trading System Access',type:'select',options:['Admin (A)','Read (R)','Write/Edit (W)','No Access (N)'],req:true},
    {id:'cscsAccess',label:'CSCS Access',type:'select',options:['Admin (A)','Read (R)','Write/Edit (W)','No Access (N)'],req:true},
    {id:'finAccess',label:'Finance System Access',type:'select',options:['Admin (A)','Read (R)','Write/Edit (W)','No Access (N)'],req:true},
    {id:'appropriate',label:'Access Appropriate to Role?',type:'select',options:['Yes — Re-certified','No — Changes Required'],req:true},
    {id:'changes',label:'Changes Required (if any)',type:'textarea',req:false},{id:'itSig',label:'IT Officer Signature',type:'text',req:true},{id:'mdSig',label:'MD Signature',type:'text',req:true},
  ]},
  { ref:'F-15', title:'VAPT Finding and Remediation Tracker', freq:'Monthly till closed', section:'Section 5d — IT Controls', owner:'IT Officer', fields:[
    {id:'reportDate',label:'Report Date',type:'date',req:true},{id:'vaptDate',label:'VAPT Conducted Date',type:'date',req:true},{id:'vendor',label:'VAPT Vendor / Tester',type:'text',req:true},
    {id:'findingRef',label:'Finding Reference',type:'text',req:true},{id:'severity',label:'Severity',type:'select',options:['Critical','High','Medium','Low','Informational'],req:true},
    {id:'description',label:'Finding Description',type:'textarea',req:true},{id:'system',label:'System / Asset Affected',type:'text',req:true},
    {id:'remediation',label:'Remediation Action Planned',type:'textarea',req:true},{id:'owner',label:'Remediation Owner',type:'text',req:true},{id:'targetDate',label:'Target Remediation Date',type:'date',req:true},
    {id:'status',label:'Status',type:'select',options:['Open','In Progress','Resolved','Accepted Risk'],req:true},{id:'itSig',label:'IT Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-16', title:'Vendor and Technology SLA Register', freq:'Quarterly', section:'Section 5d — IT Controls', owner:'IT Officer', fields:[
    {id:'period',label:'Review Period',type:'text',req:true},{id:'vendor',label:'Vendor / Service Provider Name',type:'text',req:true},{id:'service',label:'Service Description',type:'text',req:true},
    {id:'expiry',label:'Contract Expiry Date',type:'date',req:true},{id:'slaUptime',label:'SLA Agreed Uptime %',type:'text',req:true},{id:'actUptime',label:'Actual Uptime % (This Period)',type:'text',req:true},
    {id:'breach',label:'SLA Breached?',type:'select',options:['No','Yes — minor','Yes — material'],req:true},
    {id:'escalation',label:'Escalation Required?',type:'select',options:['No','Yes — see notes'],req:true},{id:'notes',label:'Notes',type:'textarea',req:false},{id:'itSig',label:'IT Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-17', title:'Control Deficiency Register', freq:'Monthly / Quarterly', section:'Section 7 — Monitoring and Review', owner:'Internal Control Officer', fields:[
    {id:'period',label:'Reporting Period',type:'text',req:true},{id:'defRef',label:'Deficiency Reference',type:'text',req:true},{id:'foundDate',label:'Date Identified',type:'date',req:true},
    {id:'controlArea',label:'Control Area / Process',type:'text',req:true},{id:'defType',label:'Deficiency Type',type:'select',options:['Design Deficiency','Operating Effectiveness Deficiency','Both'],req:true},
    {id:'severity',label:'Severity',type:'select',options:['Material Weakness','Significant Deficiency','Control Deficiency'],req:true},
    {id:'description',label:'Deficiency Description',type:'textarea',req:true},{id:'rootCause',label:'Root Cause',type:'textarea',req:true},
    {id:'actionPlan',label:'Management Response / Action Plan',type:'textarea',req:true},{id:'targetDate',label:'Target Remediation Date',type:'date',req:true},
    {id:'status',label:'Status',type:'select',options:['Open','In Progress','Remediated','Verified Closed'],req:true},{id:'icSig',label:'Internal Control Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-18', title:'Annual Risk-Based Internal Audit Plan', freq:'Annual', section:'Section 7 — Monitoring and Review', owner:'Internal Auditor', fields:[
    {id:'year',label:'Audit Year',type:'text',req:true},{id:'prepBy',label:'Prepared By',type:'text',req:true},{id:'approvedBy',label:'Approved By (Audit Committee / MD)',type:'text',req:true},
    {id:'auditArea',label:'Audit Area / Unit',type:'text',req:true},{id:'risk',label:'Risk Rating',type:'select',options:['High','Medium','Low'],req:true},
    {id:'quarter',label:'Planned Quarter',type:'select',options:['Q1','Q2','Q3','Q4'],req:true},{id:'objective',label:'Audit Objective',type:'textarea',req:true},
    {id:'resources',label:'Resources Allocated (person-days)',type:'number',req:true},{id:'status',label:'Status',type:'select',options:['Planned','In Progress','Completed','Deferred'],req:true},
    {id:'auditorSig',label:'Internal Auditor Signature',type:'text',req:true},
  ]},
  { ref:'F-19', title:'Client Complaint Register', freq:'Continuous', section:'Section 8 — Complaint Management', owner:'Compliance Officer', fields:[
    {id:'compRef',label:'Complaint Reference',type:'text',req:true},{id:'recDate',label:'Date Received',type:'date',req:true},{id:'clientName',label:'Client Name',type:'text',req:true},
    {id:'contact',label:'Client Contact Info',type:'text',req:true},{id:'channel',label:'Complaint Channel',type:'select',options:['Email','Phone','In Person','Written Letter','Portal'],req:true},
    {id:'subject',label:'Complaint Subject / Category',type:'text',req:true},{id:'description',label:'Complaint Description',type:'textarea',req:true},
    {id:'assignedTo',label:'Assigned To',type:'text',req:true},{id:'targetDate',label:'Target Resolution Date',type:'date',req:true},
    {id:'resolution',label:'Resolution / Outcome',type:'textarea',req:false},{id:'satisfied',label:'Client Satisfied?',type:'select',options:['Yes','No','Pending'],req:true},
    {id:'compSig',label:'Compliance Officer Signature',type:'text',req:true},
  ]},
  { ref:'F-20', title:'Financial Asset Valuation Reconciliation Certificate', freq:'Quarterly', section:'Section 5b — Financial Controls', owner:'Finance Officer', fields:[
    {id:'period',label:'Quarter / Year',type:'text',req:true},{id:'assetClass',label:'Asset Class',type:'select',options:['Equities','Fixed Income','Money Market','Other'],req:true},
    {id:'portRef',label:'Portfolio / Account Reference',type:'text',req:true},{id:'bookVal',label:'Book Value (NGN)',type:'number',req:true},{id:'mktVal',label:'Market Value (NGN)',type:'number',req:true},
    {id:'variance',label:'Variance (NGN)',type:'number',req:true},{id:'varExplain',label:'Variance Explanation',type:'textarea',req:true},
    {id:'priceSrc',label:'Pricing Source (e.g. NGX)',type:'text',req:true},{id:'priceDate',label:'Pricing Date',type:'date',req:true},
    {id:'finSig',label:'Finance Officer Signature',type:'text',req:true},{id:'mdSig',label:'MD Signature',type:'text',req:true},
  ]},
  { ref:'F-21', title:'Board Meeting Attendance Register', freq:'Per meeting', section:'Section 3 — Control Environment', owner:'Company Secretary', fields:[
    {id:'meetDate',label:'Meeting Date',type:'date',req:true},{id:'meetType',label:'Meeting Type',type:'select',options:['Regular Board Meeting','Audit and Risk Committee','Emergency Board Meeting','AGM'],req:true},
    {id:'venue',label:'Venue / Platform',type:'text',req:true},{id:'chair',label:'Chairperson',type:'text',req:true},{id:'quorum',label:'Quorum Met?',type:'select',options:['Yes','No'],req:true},
    {id:'attendees',label:'Attendees (comma-separated names)',type:'textarea',req:true},{id:'apologies',label:'Apologies Received From',type:'textarea',req:false},
    {id:'agenda',label:'Key Agenda Items',type:'textarea',req:true},{id:'secSig',label:'Company Secretary Signature',type:'text',req:true},
  ]},
];

// ── Forms Context (dynamic forms loaded from DB) ──────────────────────────────
// Components use useContext(FormsCtx) instead of the FORMS constant directly.
// This means when admin edits a form in FormBuilder, all components update live.
const FormsCtx = createContext(FORMS);
const useForms = () => useContext(FormsCtx);

// ── Help content ──────────────────────────────────────────────────────────────
const HELP = {
  dashboard: {
    title: 'Dashboard',
    intro: 'Your personal overview of compliance activity. Everything important is surfaced here.',
    items: [
      { q:'What are the four stat cards?', a:'They show how many policies you have signed vs total, how many acknowledgements are still pending, how many forms you have submitted, and how many forms are sitting in your inbox waiting for your action.' },
      { q:'What does "Pending Acknowledgements" mean?', a:'These are active policies that you have not yet read and signed off. Regulators require a signed record. Click Policy Library in the sidebar to complete them.' },
      { q:'What is "Inbox — Awaiting My Action"?', a:'When someone submits a form and you are set as their Level 1 or Level 2 approver, it lands in your inbox. Click My Inbox in the sidebar to review and act on them.' },
    ],
  },
  policies: {
    title: 'Policy Library',
    intro: 'Read, acknowledge and manage company policies. Every acknowledgement is permanently recorded.',
    items: [
      { q:'How do I acknowledge a policy?', a:'Click View next to any policy showing Pending status. Read the full document, type your full name in the signature box, tick the declaration checkbox, and click Sign and Acknowledge.' },
      { q:'How do I upload a PDF or Word policy? (Admin)', a:'Click Add Policy, choose Upload PDF or Word File, click the upload area to select your file, fill in the title, category and version, then Save Policy.' },
      { q:'How do I update a policy to a new version? (Admin)', a:'Click New Version next to the policy. Upload the new file and enter the new version number. When you click Archive Old and Publish New Version, the old policy is hidden from staff and the new one appears as Pending for everyone to re-sign.' },
      { q:'What happens when I archive a policy? (Admin)', a:'The policy is hidden from staff immediately. All existing signoff records are permanently preserved in the audit trail and visible in Reports.' },
      { q:'Can staff see archived policies?', a:'No. Only admins can see archived policies by clicking View Archived.' },
    ],
  },
  forms: {
    title: 'Forms and Templates',
    intro: 'Complete and submit the 21 ICF operational control forms. Each form is frequency-tagged so you know when it is due.',
    items: [
      { q:'How do I find the right form?', a:'Use the frequency filter buttons (Daily, Weekly, Monthly etc.) or search by form name or reference number (e.g. F-07).' },
      { q:'How do I complete a form?', a:'Click Complete on any form card. Fill in all required fields marked with a red asterisk. If the form has an approval workflow, you will see who it is going to before you submit.' },
      { q:'What does the approval chain shown on a form mean?', a:'It shows the greyed-out names of the Level 1 reviewer and Level 2 approver (if set). You cannot change these — they are configured by admin. Once you submit, the form automatically goes to Level 1.' },
      { q:'How do I view a past submission?', a:'Click the Submissions tab, find your form, and click View. You can also print or save as PDF from there.' },
      { q:'Can I print a completed form?', a:'Yes — click View on any submission, then click the green Print / Save as PDF button. Use your browser\'s Save as PDF option to create a file.' },
    ],
  },
  inbox: {
    title: 'My Inbox',
    intro: 'Forms submitted by colleagues that are waiting for your review or approval.',
    items: [
      { q:'What does Level 1 Review mean?', a:'You are the first person to review this form. You can approve it (which sends it to Level 2 if there is one, or marks it fully approved) or reject it with a note back to the submitter.' },
      { q:'What does Level 2 Approval mean?', a:'Level 1 has already reviewed and approved this form. You are giving final sign-off.' },
      { q:'Do I have to add a note when I approve?', a:'Notes are optional when approving but strongly recommended so there is a clear audit trail. Notes are required when rejecting — you must explain why.' },
      { q:'What happens when I reject a form?', a:'The submitter is notified by email with your rejection note. The form shows as Rejected in the system. The submitter can then correct and resubmit a new form.' },
      { q:'Can I print a form from my inbox?', a:'Yes — click Review and Act, then use the Print button in the top right of the review panel.' },
    ],
  },
  wfDash: {
    title: 'Workflow Dashboard',
    intro: 'A live view of every form in the approval pipeline across the whole organisation.',
    items: [
      { q:'What do the five stat cards show?', a:'Total forms currently in the pipeline, how many are waiting for L1 review, how many for L2 approval, how many are fully approved, and how many have been rejected.' },
      { q:'What does the Days column mean?', a:'How many days have passed since the form was last acted on. Today means it was submitted or actioned today. Forms showing 3+ days with a warning mark are considered stale.' },
      { q:'What is a stale form?', a:'A form where no action has been taken in 3 or more days. The orange warning banner shows how many stale forms exist so you can chase the relevant approver.' },
      { q:'How do I re-route a form to a different approver?', a:'Click View on any in-flight form, then click Re-route. Select the new Level 1 and/or Level 2 approver, add a note explaining the change, and confirm. The new approver receives an email notification.' },
      { q:'Can admin approve or reject forms from this dashboard?', a:'Yes — admins can open any form, review its contents, and approve or reject on behalf of the assigned approver if necessary.' },
    ],
  },
  wfSetup: {
    title: 'Workflow Setup',
    intro: 'Configure who reviews and approves each of the 21 forms.',
    items: [
      { q:'What is Level 1 vs Level 2?', a:'Level 1 is the first reviewer — typically the staff member\'s direct supervisor or department head. Level 2 is the final approver — typically the Compliance Officer or MD. L2 is optional.' },
      { q:'Can I set a workflow for only some forms?', a:'Yes. Leave the dropdowns blank for forms that do not need an approval chain. Those forms will simply be recorded as submitted with no workflow.' },
      { q:'Is Level 2 available if I haven\'t set Level 1?', a:'No. Level 2 is disabled until Level 1 is assigned. You must always have a Level 1 before Level 2.' },
      { q:'When does the new workflow take effect?', a:'Immediately. Any form submitted after you save the change will use the new routing. Forms already in the pipeline are not affected.' },
      { q:'Can the same person be both L1 and L2?', a:'No. The Level 2 dropdown automatically excludes whoever is selected as Level 1.' },
    ],
  },
  reports: {
    title: 'Reports and Analytics',
    intro: 'Three printable compliance reports covering policy sign-offs, staff activity, and form submissions.',
    items: [
      { q:'How do I print or save a report as PDF?', a:'Click the green Print / Save as PDF button in the top right. Your browser\'s print dialog will open — select Save as PDF as the destination to create a PDF file.' },
      { q:'What does the Policy Compliance report show?', a:'For each active policy: the percentage of staff who have signed it, a colour-coded progress bar (green = 100%, amber = partial, red = low), and the full list of who has and has not signed.' },
      { q:'What are the Archived Policy Records at the bottom?', a:'These are policies that have been archived (superseded by newer versions). They show the historical signoff record so the audit trail is never lost.' },
      { q:'What does the compliance score in User Activity mean?', a:'It is the percentage of active policies that the staff member has signed. 100% means they are fully compliant.' },
      { q:'What does the Form Summary show?', a:'For each of the 21 forms: how many times it has been submitted and who submitted it last and when.' },
    ],
  },
  users: {
    title: 'User Management',
    intro: 'Add, edit, reset passwords for and remove staff portal accounts.',
    items: [
      { q:'How do I add a new staff member?', a:'Click Add User, fill in their name, work email, department and role, and click Add User. They will be assigned the default password Transworld!23 and asked to set a personal password on first login.' },
      { q:'How do I change someone\'s name, email or department?', a:'Click Edit next to their name, make the changes, and click Save Changes.' },
      { q:'A staff member forgot their password — what do I do?', a:'Click Reset PW next to their name. Their password is reset to Transworld!23 and they will be forced to set a new one on next login.' },
      { q:'What happens when I delete a user?', a:'Their portal account is removed and they can no longer log in. Their policy acknowledgement records are retained in the audit trail. This cannot be undone.' },
      { q:'Can I delete my own account?', a:'No. The Delete button is hidden for the currently logged-in admin to prevent accidental lockout.' },
    ],
  },
  changepw: {
    title: 'Change Password',
    intro: 'Update your personal portal password at any time.',
    items: [
      { q:'What are the password requirements?', a:'At least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character from !@#$%^&*.' },
      { q:'I forgot my current password — what do I do?', a:'Ask your portal administrator (Okezie) to reset your password from User Management. You will then be asked to set a new one on next login.' },
      { q:'Can I reuse the default password Transworld!23?', a:'No. The system will not allow you to set the default password as your personal password.' },
    ],
  },
  help: {
    title: 'Help Centre',
    intro: 'Guides and answers for everything in the Transworld Compliance Portal.',
    items: [],
  },
};

const HELP_OVERVIEW = [
  { icon:'shield', title:'Policy Library', desc:'Upload, manage and sign off policies. Includes PDF/Word support and full version history.', page:'policies' },
  { icon:'form',   title:'Forms and Templates', desc:'All 21 ICF forms — daily, weekly, monthly, quarterly and annual. Complete, submit and print.', page:'forms' },
  { icon:'inbox',  title:'My Inbox', desc:'Forms waiting for your review or approval, with full approval history.', page:'inbox' },
  { icon:'flow',   title:'Workflow Dashboard', desc:'Live pipeline view — see where every form is stalled and re-route if needed.', page:'wfDash' },
  { icon:'cog',    title:'Workflow Setup', desc:'Assign Level 1 and Level 2 approvers for each form.', page:'wfSetup' },
  { icon:'chart',  title:'Reports', desc:'Three printable reports: policy compliance, staff activity, and form summary.', page:'reports' },
  { icon:'users',  title:'User Management', desc:'Add, edit, reset passwords for and remove staff accounts.', page:'users' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function uName(users, id) {
  const u = users.find(u => u.id === id);
  return u ? u.name : 'Unknown';
}
function uEmail(users, id) {
  const u = users.find(u => u.id === id);
  return u ? u.email : null;
}
function getApprover(sub) {
  if (!sub || !sub.wfStatus) return null;
  if (sub.wfStatus === 'pending_l1')  return sub.wf && sub.wf.l1;
  if (sub.wfStatus === 'pending_l2')  return sub.wf && sub.wf.l2;
  if (sub.wfStatus === 'pending_doa') {
    const idx = sub.wf?.currentStep ?? 0;
    return sub.wf?.steps?.[idx]?.userId || null;
  }
  return null;
}

// ── DoA routing builder ────────────────────────────────────────────────────────
function buildDoaSteps(amount, submitterId, users, doaConfig) {
  const amt = parseFloat(String(amount).replace(/,/g,'')) || 0;
  const isLineManager = users.some(u => u.lineManager === submitterId);
  const submitter     = users.find(u => u.id === submitterId);
  const lmId          = submitter?.lineManager;
  const { financeUser, complianceUser, mdUser, chairmanUser } = doaConfig;

  const step = (userId, role, label) => ({ userId, role, label: label || role });
  const steps = [];

  if (amt <= 50000) {
    // Petty cash — Finance only, no review
    if (financeUser) steps.push(step(financeUser, 'Finance', 'Finance — Record & Pay'));
  } else if (amt <= 4999999) {
    // Senior Management then Finance
    if (!isLineManager && lmId) steps.push(step(lmId, 'Line Manager', 'Senior Management'));
    if (financeUser) steps.push(step(financeUser, 'Finance', 'Finance — Record & Pay'));
  } else if (amt <= 10000000) {
    // Line Manager → Compliance → MD → Finance
    if (!isLineManager && lmId) steps.push(step(lmId, 'Line Manager', 'Senior Management'));
    if (complianceUser) steps.push(step(complianceUser, 'Compliance', 'Compliance Review'));
    if (mdUser)         steps.push(step(mdUser, 'Managing Director', 'Managing Director'));
    if (financeUser)    steps.push(step(financeUser, 'Finance', 'Finance — Record & Pay'));
  } else {
    // Line Manager → Compliance → MD → Chairman → Finance
    if (!isLineManager && lmId) steps.push(step(lmId, 'Line Manager', 'Senior Management'));
    if (complianceUser) steps.push(step(complianceUser, 'Compliance', 'Compliance Review'));
    if (mdUser)         steps.push(step(mdUser, 'Managing Director', 'Managing Director'));
    if (chairmanUser)   steps.push(step(chairmanUser, 'Chairman', 'Chairman of the Board'));
    if (financeUser)    steps.push(step(financeUser, 'Finance', 'Finance — Record & Pay'));
  }
  return steps;
}

function doaBlockReason(submitterId, doaConfig) {
  if (submitterId === doaConfig.financeUser)    return 'The designated Finance Officer cannot initiate a Payment Approval form. Please ask a colleague to submit on your behalf.';
  if (submitterId === doaConfig.complianceUser) return 'The designated Compliance Officer cannot initiate a Payment Approval form.';
  return null;
}

function formatNGN(val) {
  const n = parseFloat(String(val||'').replace(/,/g,''));
  if (isNaN(n)) return '';
  return '₦' + n.toLocaleString('en-NG');
}

// ── Email notification ─────────────────────────────────────────────────────────
async function sendNotify({ to, toName, fromName, formRef, formTitle, level, note, approverName, isReceipt }) {
  if (!to) { console.warn('sendNotify: no recipient email'); return; }
  try {
    const res = await fetch('/api/notify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, toName, fromName, formRef, formTitle, level, note, approverName, isReceipt, portalUrl: window.location.origin }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Email notification failed:', data);
    } else {
      console.log('Email sent to', to, '— response:', data);
    }
  } catch (e) {
    console.warn('Email notification error:', e.message);
  }
}

// ── Print function ─────────────────────────────────────────────────────────────
function printSubmission(sub, users, forms) {
  const form = (forms || FORMS).find(f => f.ref === sub.formRef);
  if (!form) return;
  const sm  = WF_STATUS[sub.wfStatus || 'no_workflow'];
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const fieldRows = Object.entries(sub.data).map(([k, v]) => {
    if (k.startsWith('_')) return '';
    const field = form.fields.find(f => f.id === k);
    const label = field ? field.label : k;
    // File attachments
    if (Array.isArray(v) && v.length > 0 && v[0]?.url) {
      const links = v.map(f => `<a href="${f.url}" style="display:block;color:#4f46e5;font-size:9.5pt;margin-top:3px;">📎 ${f.name}</a>`).join('');
      return `<div class="field"><div class="field-label">${label}</div><div class="field-value">${links}</div></div>`;
    }
    const value = typeof v === 'boolean' ? (v ? '☑ Yes' : '☐ No') : (String(v) || '—');
    return `<div class="field"><div class="field-label">${label}</div><div class="field-value">${value}</div></div>`;
  }).join('');

  const approvalRows = (sub.approvals || []).map(a => `
    <div style="margin-bottom:8px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:4px;">
      <span style="font-weight:700;color:${a.action === 'approved' ? '#059669' : '#dc2626'};">
        Level ${a.level} ${a.action === 'approved' ? 'Approved' : 'Rejected'}
      </span>
      — ${uName(users, a.userId)}<br/>
      <span style="font-size:9pt;color:#6b7280;">${new Date(a.at).toLocaleString()}</span>
      ${a.note ? `<br/><em style="font-size:10pt;color:#374151;">"${a.note}"</em>` : ''}
    </div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>${form.ref} — ${form.title}</title>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 0; }
  .page { padding: 20mm 22mm; max-width: 210mm; margin: 0 auto; }
  .header { border-bottom: 3px solid #0d1f3c; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
  .org { font-size: 15pt; font-weight: 700; color: #0d1f3c; }
  .sub-org { font-size: 8pt; color: #6b7280; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .form-title { font-size: 16pt; font-weight: 700; color: #0d1f3c; margin: 0 0 4px; }
  .form-meta { font-size: 9pt; color: #6b7280; }
  .ref-badge { display: inline-block; background: #0d1f3c; color: #c9a84c; padding: 4px 12px; border-radius: 4px; font-size: 11pt; font-weight: 700; margin-right: 8px; }
  .status-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 9pt; font-weight: 600; background: ${sm.bg}; color: ${sm.color}; }
  .section-title { font-size: 9pt; font-weight: 700; color: #0d1f3c; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 18px 0 10px; text-transform: uppercase; letter-spacing: 1px; }
  .fields-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .field { margin-bottom: 8px; }
  .field-label { font-size: 7.5pt; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
  .field-value { font-size: 10.5pt; color: #1a1a2e; margin-top: 2px; padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
  .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 8pt; color: #9ca3af; display: flex; justify-content: space-between; }
  @page { size: A4; margin: 0; }
</style>
</head><body>
<div class="page">
  <div class="header">
    <div>
      <div class="org">Transworld Investment and Securities Limited</div>
      <div class="sub-org">Compliance and Control Portal — Official Form Record</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:9pt;color:#6b7280;">Printed: ${now}</div>
    </div>
  </div>

  <div style="margin-bottom:18px;">
    <div style="margin-bottom:8px;">
      <span class="ref-badge">${form.ref}</span>
      <span class="status-badge">${sm.label}</span>
    </div>
    <div class="form-title">${form.title}</div>
    <div class="form-meta">
      ${form.section} &nbsp;|&nbsp; Owner: ${form.owner} &nbsp;|&nbsp; Frequency: ${form.freq}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:12px;background:#f9fafb;border-radius:6px;margin-bottom:18px;font-size:9.5pt;">
    <div><div class="field-label">Submitted By</div><div style="font-weight:600;">${sub.submittedByName}</div></div>
    <div><div class="field-label">Submission Date</div><div>${new Date(sub.submittedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div></div>
    <div><div class="field-label">Form ID</div><div style="font-family:monospace;">${sub.id}</div></div>
  </div>

  <div class="section-title">Form Data</div>
  <div class="fields-grid">
    ${Object.entries(sub.data).map(([k, v]) => {
      const field = form.fields.find(f => f.id === k);
      const label = field ? field.label : k;
      const value = typeof v === 'boolean' ? (v ? '☑ Yes' : '☐ No') : (String(v) || '—');
      const wide  = field && (field.type === 'textarea' || String(value).length > 60);
      return `<div class="field" ${wide ? 'style="grid-column:1/-1"' : ''}>
        <div class="field-label">${label}</div>
        <div class="field-value">${value}</div>
      </div>`;
    }).join('')}
  </div>

  ${(sub.approvals || []).length > 0 ? `
  <div class="section-title">Approval Trail</div>
  ${approvalRows}
  ` : ''}

  ${sub.wf && sub.wf.l1 ? `
  <div class="section-title">Workflow Status</div>
  <div style="font-size:9.5pt;color:#374151;margin-bottom:4px;">
    Level 1 Reviewer: <strong>${uName(users, sub.wf.l1)}</strong>
    ${sub.wf.l2 ? ` &nbsp;|&nbsp; Level 2 Approver: <strong>${uName(users, sub.wf.l2)}</strong>` : ''}
  </div>
  <div style="font-size:9.5pt;color:#374151;">Current Status: <strong style="color:${sm.color}">${sm.label}</strong></div>
  ` : ''}

  <div class="footer">
    <div>Transworld Investment and Securities Limited — Compliance and Control Portal</div>
    <div>This is an official document. Do not alter after printing.</div>
  </div>
</div>
</body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const S = {
  sidebar:  { width:250, background:NAV, minHeight:'100vh', display:'flex', flexDirection:'column', position:'fixed', left:0, top:0, zIndex:50 },
  main:     { marginLeft:250, minHeight:'100vh' },
  topbar:   { background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 26px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:40 },
  page:     { padding:26 },
  card:     { background:'#fff', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)' },
  modal:    { background:'#fff', borderRadius:12, width:'100%', maxWidth:640, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.25)' },
  overlay:  { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:14 },
  loginBg:  { minHeight:'100vh', background:NAV, display:'flex', alignItems:'center', justifyContent:'center' },
  loginCard:{ background:'#fff', borderRadius:16, padding:'42px 38px', width:410, boxShadow:'0 30px 80px rgba(0,0,0,0.4)' },
};
function inp(extra) { return { width:'100%', padding:'8px 11px', border:'1.5px solid #d1d5db', borderRadius:7, fontFamily:'inherit', fontSize:13, background:'#fff', color:'#1a1a2e', outline:'none', ...extra }; }
function btn(type) {
  const base = { display:'inline-flex', alignItems:'center', gap:6, padding:'8px 15px', borderRadius:7, fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer', border:'none', transition:'all 0.15s' };
  if (type === 'primary') return { ...base, background:NAV, color:'#fff' };
  if (type === 'gold')    return { ...base, background:GOLD, color:'#1a1a2e' };
  if (type === 'outline') return { ...base, background:'transparent', border:'1.5px solid #d1d5db', color:'#374151' };
  if (type === 'danger')  return { ...base, background:'#fee2e2', color:'#dc2626' };
  if (type === 'green')   return { ...base, background:'#d1fae5', color:'#059669' };
  return base;
}
function bdg(bg, color) { return { display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:500, background:bg, color }; }
function pll(bg)        { return { display:'inline-flex', padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, color:'#fff', background:bg }; }
function lbl()          { return { display:'block', fontSize:10.5, fontWeight:600, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:0.5 }; }

// ── Icon component ─────────────────────────────────────────────────────────────
function Icon({ name, size, color }) {
  const sz = size || 18;
  const cl = color || 'currentColor';
  const paths = {
    home:    'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    doc:     'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
    chart:   'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm9.75-4.875C12.75 7.629 13.254 7.125 13.875 7.125h2.25c.621 0 1.125.504 1.125 1.125v12.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.25zm-4.875 4.5C7.875 12.129 8.379 11.625 9 11.625h2.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125H9a1.125 1.125 0 01-1.125-1.125v-8.25z',
    users:   'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
    check:   'M4.5 12.75l6 6 9-13.5',
    x:       'M6 18L18 6M6 6l12 12',
    logout:  'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
    eye:     'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z',
    plus:    'M12 4.5v15m7.5-7.5h-15',
    form:    'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z',
    shield:  'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 01.75 9.748c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    lock:    'M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z',
    bell:    'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
    inbox:   'M2.25 13.5h3.86a2.251 2.251 0 012.012 1.244l.256.512a2.251 2.251 0 002.013 1.244h3.218a2.251 2.251 0 002.013-1.244l.256-.512a2.251 2.251 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z',
    cog:     'M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    flow:    'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z',
    question:'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z',
    book:    'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
    download:'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3',
    print:   'M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z',
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={sz} height={sz} viewBox="0 0 24 24"
      fill="none" stroke={cl} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

// ── Th component (table header) ────────────────────────────────────────────────
function Th({ children }) {
  return <th style={{ padding:'9px 13px', background:'#f9fafb', color:'#6b7280', fontSize:10, textTransform:'uppercase', letterSpacing:0.5, fontWeight:600, textAlign:'left', borderBottom:'1px solid #e5e7eb' }}>{children}</th>;
}
function Td({ children, style }) {
  return <td style={{ padding:'11px 13px', borderBottom:'1px solid #f3f4f6', verticalAlign:'middle', ...style }}>{children}</td>;
}

// ── Share / Embed Modal ────────────────────────────────────────────────────────
function ShareModal({ form, onClose }) {
  const [copied, setCopied] = useState('');
  const origin = window.location.origin;
  const url    = `${origin}/form/${form.ref}`;
  const embed  = `<iframe src="${url}" width="100%" height="750" frameborder="0" style="border-radius:12px;"></iframe>`;

  function copy(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2200);
    });
  }

  const boxStyle = { background:'#f9fafb', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'12px 14px', fontFamily:'monospace', fontSize:12, color:'#374151', wordBreak:'break-all', lineHeight:1.6 };

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth:580 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:NAV }}>Share Form Publicly</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:2 }}>{form.ref} — {form.title}</div>
          </div>
          <button style={btn('outline')} onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div style={{ padding:'22px 24px', display:'flex', flexDirection:'column', gap:20 }}>

          {/* Info banner */}
          <div style={{ padding:'12px 15px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:9, fontSize:13, color:'#065f46', lineHeight:1.6 }}>
            This form is <strong>publicly accessible</strong>. Anyone with the link can fill it out without logging in. Submissions appear in your portal with an <strong>External</strong> badge and follow the same approval workflow.
          </div>

          {/* Direct link */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
              Direct Link — share with clients or staff
            </div>
            <div style={boxStyle}>{url}</div>
            <div style={{ display:'flex', gap:9, marginTop:9 }}>
              <button style={{ ...btn('primary'), padding:'7px 14px', fontSize:12 }} onClick={() => copy(url, 'link')}>
                <Icon name="doc" size={13} /> {copied === 'link' ? '✓ Copied!' : 'Copy Link'}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btn('outline'), padding:'7px 14px', fontSize:12, textDecoration:'none' }}>
                <Icon name="eye" size={13} /> Preview Form
              </a>
            </div>
          </div>

          {/* Embed code */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>
              Embed Code — paste into your website HTML
            </div>
            <div style={boxStyle}>{embed}</div>
            <button style={{ ...btn('outline'), padding:'7px 14px', fontSize:12, marginTop:9 }} onClick={() => copy(embed, 'embed')}>
              <Icon name="doc" size={13} /> {copied === 'embed' ? '✓ Copied!' : 'Copy Embed Code'}
            </button>
          </div>

          {/* QR hint */}
          <div style={{ padding:'11px 14px', background:'#f8faff', border:'1.5px solid #e0e7ff', borderRadius:8, fontSize:12.5, color:'#374151' }}>
            <strong>Tip:</strong> You can also generate a QR code from this link using any free QR code generator and print it on client documents or brochures.
          </div>
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end' }}>
          <button style={btn('outline')} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Help Panel (context-sensitive slide-in) ───────────────────────────────────
function HelpPanel({ page, onClose }) {
  const content = HELP[page] || HELP.dashboard;
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div style={{ position:'fixed', top:0, right:0, bottom:0, width:380, background:'#fff', zIndex:200, boxShadow:'-4px 0 24px rgba(0,0,0,0.15)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'20px 22px', background:NAV, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ color:GOLD, fontSize:10, letterSpacing:2, textTransform:'uppercase', marginBottom:3 }}>Help</div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:'#fff' }}>{content.title}</div>
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:6, padding:'6px 8px', cursor:'pointer', color:'#fff' }}>
          <Icon name="x" size={16} color="#fff" />
        </button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'20px 22px' }}>
        <p style={{ fontSize:13, color:'#374151', lineHeight:1.7, marginBottom:20, padding:'12px 14px', background:'#f0f4ff', borderRadius:8, borderLeft:`3px solid ${GOLD}` }}>
          {content.intro}
        </p>
        {content.items.map((item, i) => (
          <div key={i} style={{ marginBottom:10, border:'1.5px solid #e5e7eb', borderRadius:9, overflow:'hidden' }}>
            <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
              style={{ width:'100%', padding:'12px 16px', background: openIdx===i?'#f9fafb':'#fff', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit', textAlign:'left' }}>
              <span style={{ fontSize:13, fontWeight:600, color:NAV, paddingRight:10 }}>{item.q}</span>
              <span style={{ fontSize:18, color:GOLD, flexShrink:0, transition:'transform 0.2s', transform: openIdx===i?'rotate(45deg)':'rotate(0deg)' }}>+</span>
            </button>
            {openIdx === i && (
              <div style={{ padding:'12px 16px', background:'#fafafa', borderTop:'1px solid #f3f4f6', fontSize:13, color:'#374151', lineHeight:1.7 }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop:20, padding:'12px 14px', background:'#fffbeb', borderRadius:8, border:'1.5px solid #fde68a', fontSize:12, color:'#92400e' }}>
          Need more help? Contact your portal administrator or visit the <strong>Help Centre</strong> in the sidebar.
        </div>
      </div>
    </div>
  );
}

// ── Help Centre (full page) ───────────────────────────────────────────────────
function HelpPage({ setPage }) {
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState(null);

  const allItems = Object.entries(HELP)
    .filter(([k]) => k !== 'help')
    .flatMap(([section, content]) =>
      content.items.map(item => ({ ...item, section: content.title }))
    );

  const filtered = search.trim()
    ? allItems.filter(i =>
        i.q.toLowerCase().includes(search.toLowerCase()) ||
        i.a.toLowerCase().includes(search.toLowerCase()) ||
        i.section.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, color:NAV }}>Help Centre</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:3 }}>Guides, FAQs and tutorials for the Transworld Compliance Portal</div>
      </div>

      {/* Search */}
      <div style={{ marginBottom:28, position:'relative' }}>
        <Icon name="eye" size={16} color="#9ca3af" />
        <input style={{ ...inp(), paddingLeft:38, fontSize:14, maxWidth:520 }}
          placeholder="Search help topics, e.g. 'how do I print a form'..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
          <Icon name="eye" size={16} color="#9ca3af" />
        </div>
      </div>

      {/* Search results */}
      {filtered && (
        <div style={{ marginBottom:28 }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"
          </div>
          {filtered.length === 0 ? (
            <div style={{ ...S.card, padding:32, textAlign:'center', color:'#6b7280', fontSize:13 }}>
              No results found. Try different keywords or browse the topics below.
            </div>
          ) : (
            filtered.map((item, i) => (
              <div key={i} style={{ marginBottom:8, border:'1.5px solid #e5e7eb', borderRadius:9, overflow:'hidden' }}>
                <button onClick={() => setOpenKey(`search-${i}`)}
                  style={{ width:'100%', padding:'12px 16px', background: openKey===`search-${i}`?'#f9fafb':'#fff', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit', textAlign:'left' }}>
                  <div>
                    <div style={{ fontSize:11, color:GOLD, fontWeight:600, marginBottom:3 }}>{item.section}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:NAV }}>{item.q}</div>
                  </div>
                  <span style={{ fontSize:18, color:GOLD, flexShrink:0 }}>{openKey===`search-${i}`?'−':'+'}</span>
                </button>
                {openKey === `search-${i}` && (
                  <div style={{ padding:'12px 16px', background:'#fafafa', borderTop:'1px solid #f3f4f6', fontSize:13, color:'#374151', lineHeight:1.7 }}>{item.a}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick-nav cards */}
      {!filtered && (
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Browse by Section</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:14, marginBottom:32 }}>
            {HELP_OVERVIEW.map(h => (
              <div key={h.page} style={{ ...S.card, padding:18, cursor:'pointer', transition:'box-shadow 0.15s', borderTop:`3px solid ${GOLD}` }}
                onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.1)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow=''}
                onClick={() => setPage(h.page)}>
                <div style={{ width:36, height:36, background:`${NAV}12`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:10 }}>
                  <Icon name={h.icon} size={18} color={NAV} />
                </div>
                <div style={{ fontWeight:600, fontSize:13.5, color:NAV, marginBottom:4 }}>{h.title}</div>
                <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{h.desc}</div>
              </div>
            ))}
          </div>

          {/* Full FAQ accordion by section */}
          <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:14 }}>Frequently Asked Questions</div>
          {Object.entries(HELP).filter(([k]) => k !== 'help').map(([key, content]) => (
            <div key={key} style={{ marginBottom:22 }}>
              <div style={{ fontWeight:700, fontSize:14, color:NAV, marginBottom:10, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:4, height:18, background:GOLD, borderRadius:2 }} />
                {content.title}
              </div>
              {content.items.map((item, i) => {
                const k = `${key}-${i}`;
                return (
                  <div key={k} style={{ marginBottom:7, border:'1.5px solid #e5e7eb', borderRadius:9, overflow:'hidden' }}>
                    <button onClick={() => setOpenKey(openKey===k?null:k)}
                      style={{ width:'100%', padding:'11px 16px', background: openKey===k?'#f9fafb':'#fff', border:'none', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'inherit', textAlign:'left' }}>
                      <span style={{ fontSize:13, fontWeight:600, color:NAV, paddingRight:10 }}>{item.q}</span>
                      <span style={{ fontSize:18, color:GOLD, flexShrink:0 }}>{openKey===k?'−':'+'}</span>
                    </button>
                    {openKey === k && (
                      <div style={{ padding:'11px 16px', background:'#fafafa', borderTop:'1px solid #f3f4f6', fontSize:13, color:'#374151', lineHeight:1.7 }}>{item.a}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────────
function Login({ users, onLogin }) {
  const [email, setEmail] = useState('');
  const [pw, setPw]       = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep]   = useState('email');
  const [found, setFound] = useState(null);
  const [err, setErr]     = useState('');

  function next() {
    const u = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (u) { setFound(u); setErr(''); setStep('pw'); } else setErr('No account found with that email address.');
  }
  function doLogin() {
    if (pw === found.pw) onLogin(found); else setErr('Incorrect password. Please try again.');
  }

  return (
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <div style={{ textAlign:'center', marginBottom:26 }}>
          <div style={{ width:50, height:50, background:GOLD, borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 13px' }}>
            <Icon name="shield" size={25} color={NAV} />
          </div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, color:NAV, fontWeight:700, lineHeight:1.35 }}>
            Transworld Investment<br />and Securities Limited
          </div>
          <div style={{ fontSize:10, color:'#9ca3af', letterSpacing:2, marginTop:4, textTransform:'uppercase' }}>Compliance and Control Portal</div>
        </div>
        {step === 'email' && (
          <div>
            <div style={{ marginBottom:13 }}>
              <label style={lbl()}>Work Email Address</label>
              <input style={inp()} type="email" value={email} autoFocus
                onChange={e => { setEmail(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && next()}
                placeholder="yourname@transworldltd.com.ng" />
            </div>
            {err && <div style={{ color:'#dc2626', fontSize:12, marginBottom:10, padding:'7px 10px', background:'#fee2e2', borderRadius:6 }}>{err}</div>}
            <button style={{ ...btn('primary'), width:'100%', justifyContent:'center', padding:11 }} onClick={next}>Continue</button>
          </div>
        )}
        {step === 'pw' && (
          <div>
            <div style={{ padding:'8px 11px', background:'#f0f4ff', borderRadius:8, marginBottom:14, display:'flex', alignItems:'center', gap:9 }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:NAV, flexShrink:0 }}>{found.name.charAt(0)}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:12.5, fontWeight:600, color:NAV }}>{found.name}</div><div style={{ fontSize:11, color:'#6b7280' }}>{found.email}</div></div>
              <button onClick={() => { setStep('email'); setPw(''); setErr(''); }} style={{ fontSize:11, color:'#6b7280', background:'none', border:'none', cursor:'pointer' }}>Change</button>
            </div>
            <div style={{ marginBottom:13 }}>
              <label style={lbl()}>Password</label>
              <div style={{ position:'relative' }}>
                <input style={{ ...inp(), paddingRight:50 }} type={showPw ? 'text' : 'password'} value={pw} autoFocus
                  onChange={e => { setPw(e.target.value); setErr(''); }} onKeyDown={e => e.key === 'Enter' && doLogin()} placeholder="Enter your password" />
                <button onClick={() => setShowPw(!showPw)} style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#6b7280', fontSize:11 }}>{showPw ? 'Hide' : 'Show'}</button>
              </div>
            </div>
            {err && <div style={{ color:'#dc2626', fontSize:12, marginBottom:10, padding:'7px 10px', background:'#fee2e2', borderRadius:6 }}>{err}</div>}
            <button style={{ ...btn('primary'), width:'100%', justifyContent:'center', padding:11 }} onClick={doLogin}>Sign In</button>
            <div style={{ textAlign:'center', marginTop:9, fontSize:11, color:'#9ca3af' }}>First time? Default password: <strong style={{ color:NAV }}>Transworld!23</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Change Password ────────────────────────────────────────────────────────────
function ChangePw({ user, users, setUsers, onDone, forced }) {
  const [cur, setCur]   = useState('');
  const [p1, setP1]     = useState('');
  const [p2, setP2]     = useState('');
  const [err, setErr]   = useState('');
  const [ok, setOk]     = useState(false);
  const rules = [
    { text:'At least 8 characters',       pass: p1.length >= 8 },
    { text:'Uppercase letter',             pass: /[A-Z]/.test(p1) },
    { text:'Lowercase letter',             pass: /[a-z]/.test(p1) },
    { text:'Number',                       pass: /[0-9]/.test(p1) },
    { text:'Special character (!@#$%^&*)', pass: /[!@#$%^&*]/.test(p1) },
  ];
  const strong = rules.every(r => r.pass);
  async function doSave() {
    setErr('');
    if (cur !== user.pw)          { setErr('Current password is incorrect.'); return; }
    if (!strong)                   { setErr('Please meet all password requirements.'); return; }
    if (p1 !== p2)                { setErr('New passwords do not match.'); return; }
    if (p1 === 'Transworld!23')   { setErr('New password cannot be the default password.'); return; }
    await dbUpdateUser({ id:user.id, pw:p1, mustChange:false });
    const newUser = { ...user, pw:p1, mustChange:false };
    setUsers(prev => prev.map(u => u.id === user.id ? newUser : u));
    setOk(true);
    setTimeout(() => onDone(newUser), 1400);
  }
  const form = (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {forced && <div style={{ padding:'9px 12px', background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:7, fontSize:12, color:'#92400e' }}>You are using the default password. Please create a personal password to continue.</div>}
      <div><label style={lbl()}>Current Password</label><input style={inp()} type="password" value={cur} onChange={e => setCur(e.target.value)} /></div>
      <div>
        <label style={lbl()}>New Password</label>
        <input style={inp()} type="password" value={p1} onChange={e => setP1(e.target.value)} />
        {p1.length > 0 && <div style={{ marginTop:8, display:'grid', gridTemplateColumns:'1fr 1fr', gap:3 }}>{rules.map(r => <div key={r.text} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:r.pass ? '#059669' : '#9ca3af' }}><span>{r.pass ? '✓' : '○'}</span>{r.text}</div>)}</div>}
      </div>
      <div><label style={lbl()}>Confirm New Password</label><input style={inp()} type="password" value={p2} onChange={e => setP2(e.target.value)} />{p2.length > 0 && p1 !== p2 && <div style={{ fontSize:11, color:'#dc2626', marginTop:3 }}>Passwords do not match</div>}</div>
      {err && <div style={{ color:'#dc2626', fontSize:12, padding:'8px 11px', background:'#fee2e2', borderRadius:6 }}>{err}</div>}
      {ok  && <div style={{ color:'#059669', fontSize:12, padding:'8px 11px', background:'#d1fae5', borderRadius:6 }}>Password updated! Redirecting...</div>}
      <button style={{ ...btn('primary'), alignSelf:'flex-start' }} onClick={doSave}><Icon name="check" size={14} /> {forced ? 'Set Password and Continue' : 'Update Password'}</button>
    </div>
  );
  if (forced) return (
    <div style={S.loginBg}><div style={{ ...S.loginCard, maxWidth:470 }}>
      <div style={{ textAlign:'center', marginBottom:22 }}>
        <div style={{ width:46, height:46, background:'#fef3c7', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 11px' }}><Icon name="lock" size={22} color="#92400e" /></div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:NAV, fontWeight:700 }}>Set Your Password</div>
        <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>Welcome, <strong>{user.name}</strong></div>
      </div>
      {form}
    </div></div>
  );
  return form;
}

// ── Policy modal ───────────────────────────────────────────────────────────────
function PolicyModal({ policy, user, signoffs, onSign, onClose }) {
  const signed  = signoffs.find(s => s.policy_id === policy.id && s.user_id === user.id);
  const [sig, setSig]       = useState('');
  const [agreed, setAgreed] = useState(false);
  const [done, setDone]     = useState(false);

  const hasPdf  = policy.file_url && policy.file_type === 'pdf';
  const hasWord = policy.file_url && (policy.file_type === 'docx' || policy.file_type === 'doc');
  const hasFile = hasPdf || hasWord;

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth:860 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'flex-start', position:'sticky', top:0, background:'#fff' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, color:NAV }}>{policy.title}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{policy.category} · Version {policy.version} · {policy.date}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {hasFile && (
              <a href={policy.file_url} target="_blank" rel="noopener noreferrer" download={policy.file_name}
                style={{ ...btn('green'), padding:'6px 12px', fontSize:12, textDecoration:'none' }}>
                <Icon name="download" size={14} /> Download {policy.file_type.toUpperCase()}
              </a>
            )}
            <button style={btn('outline')} onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
        </div>
        <div style={{ padding:'20px 22px' }}>

          {/* PDF inline viewer */}
          {hasPdf && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Policy Document</div>
              <iframe
                src={policy.file_url}
                style={{ width:'100%', height:480, border:'1.5px solid #e5e7eb', borderRadius:8, background:'#f9fafb' }}
                title={policy.title}
              />
            </div>
          )}

          {/* Word doc download notice */}
          {hasWord && (
            <div style={{ marginBottom:16, padding:16, background:'#f0f4ff', border:'1.5px solid #c7d2fe', borderRadius:8, display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:40, height:40, background:'#2563eb', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon name="doc" size={22} color="#fff" />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:13, color:NAV }}>{policy.file_name}</div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Word document — click Download to open in Microsoft Word or Google Docs</div>
              </div>
              <a href={policy.file_url} target="_blank" rel="noopener noreferrer" download={policy.file_name}
                style={{ ...btn('primary'), textDecoration:'none', fontSize:12 }}>
                <Icon name="download" size={13} /> Download
              </a>
            </div>
          )}

          {/* Text content fallback */}
          {!hasFile && policy.content && (
            <div style={{ fontSize:13, lineHeight:1.8, color:'#374151', background:'#f9fafb', padding:16, borderRadius:8, border:'1px solid #e5e7eb', maxHeight:300, overflowY:'auto', marginBottom:16 }}>
              {policy.content}
            </div>
          )}

          {!signed && !done && (
            <div style={{ marginTop:8, padding:16, background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:8 }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:11, color:NAV }}>Electronic Acknowledgement</div>
              <div style={{ marginBottom:11 }}>
                <label style={lbl()}>Type Your Full Name (Electronic Signature)</label>
                <input style={inp()} value={sig} onChange={e => setSig(e.target.value)} placeholder={user.name} />
              </div>
              <label style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer', fontSize:12.5 }}>
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ marginTop:3 }} />
                <span>I confirm I have read and understood this policy and agree to be bound by its terms. This constitutes my electronic signature.</span>
              </label>
              <div style={{ marginTop:12 }}>
                <button style={{ ...btn('gold'), opacity:(!sig.trim() || !agreed) ? 0.5 : 1 }} disabled={!sig.trim() || !agreed}
                  onClick={() => { onSign(policy.id, policy.title, policy.version); setDone(true); }}>
                  <Icon name="check" size={14} /> Sign and Acknowledge
                </button>
              </div>
            </div>
          )}
          {(signed || done) && (
            <div style={{ marginTop:16, padding:16, background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:8, display:'flex', alignItems:'center', gap:11 }}>
              <Icon name="check" size={20} color="#059669" />
              <div>
                <div style={{ fontWeight:600, color:'#059669', fontSize:13 }}>Policy Acknowledged</div>
                <div style={{ fontSize:12, color:'#374151' }}>Signed by {user.name} on {signed ? new Date(signed.signed_at).toLocaleDateString() : new Date().toLocaleDateString()}</div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end' }}>
          <button style={btn('outline')} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Workflow status bar ────────────────────────────────────────────────────────
function WfBar({ sub, users }) {
  if (!sub || !sub.wf) return null;

  // ── DoA multi-step chain ───────────────────────────────────────────────────
  if (sub.wf.type === 'doa') {
    const steps      = sub.wf.steps || [];
    const current    = sub.wf.currentStep ?? 0;
    const isApproved = sub.wfStatus === 'approved';
    const isRejected = sub.wfStatus === 'rejected';
    const rejectedAt = (sub.approvals || []).find(a => a.action === 'rejected');
    const approvedSteps = new Set((sub.approvals || []).filter(a => a.action === 'approved').map(a => a.stepIndex));

    const stepColors = { 'Finance':'#059669','Compliance':'#7c3aed','Managing Director':'#2563eb','Chairman':'#dc2626','Line Manager':'#d97706' };

    return (
      <div style={{ marginTop:16, padding:14, background:'#f8faff', border:'1.5px solid #e0e7ff', borderRadius:10 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
          Delegation of Authority — Approval Chain
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          {/* Submitted */}
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px', borderRadius:7, border:'1.5px solid #86efac', background:'#f0fdf4' }}>
            <div style={{ width:20, height:20, borderRadius:'50%', background:'#059669', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="check" size={11} color="#fff" />
            </div>
            <div style={{ fontSize:11 }}>
              <div style={{ fontWeight:600, color:'#059669' }}>Submitted</div>
              <div style={{ color:'#6b7280', fontSize:10 }}>{uName(users, sub.submittedBy)}</div>
            </div>
          </div>

          {steps.map((step, idx) => {
            const isDone     = approvedSteps.has(idx) || (isApproved && idx < steps.length);
            const isCurrent  = !isApproved && !isRejected && idx === current;
            const isRejHere  = rejectedAt && rejectedAt.stepIndex === idx;
            const clr        = stepColors[step.role] || '#6b7280';
            const approval   = (sub.approvals || []).find(a => a.stepIndex === idx && a.action === 'approved');
            return (
              <span key={idx} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ color:'#d1d5db', fontSize:14 }}>→</span>
                <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px', borderRadius:7, border:`1.5px solid ${isRejHere?'#fca5a5':isDone?'#86efac':isCurrent?clr+'88':'#e5e7eb'}`, background:isRejHere?'#fff1f2':isDone?'#f0fdf4':isCurrent?clr+'11':'#fafafa' }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:isRejHere?'#dc2626':isDone?'#059669':isCurrent?clr:'#d1d5db' }}>
                    {isDone && !isRejHere ? <Icon name="check" size={11} color="#fff" /> : <span style={{ fontSize:10, fontWeight:700, color:'#fff' }}>{idx+1}</span>}
                  </div>
                  <div style={{ fontSize:11 }}>
                    <div style={{ fontWeight:600, color:isRejHere?'#dc2626':isDone?'#059669':isCurrent?clr:'#9ca3af' }}>
                      {isRejHere?'Rejected':isDone?'Approved':isCurrent?step.label:'Pending'}
                    </div>
                    <div style={{ color:'#6b7280', fontSize:10 }}>{uName(users, step.userId)}</div>
                    {approval && <div style={{ color:'#9ca3af', fontSize:9 }}>{new Date(approval.at).toLocaleDateString()}</div>}
                  </div>
                </div>
              </span>
            );
          })}
        </div>
        {rejectedAt && (
          <div style={{ marginTop:10, padding:'8px 11px', background:'#fff1f2', borderRadius:6, fontSize:12, color:'#dc2626' }}>
            <strong>Rejection note from {uName(users, rejectedAt.userId)}:</strong> {rejectedAt.note || 'No note provided.'}
          </div>
        )}
      </div>
    );
  }

  // ── Standard L1/L2 chain ──────────────────────────────────────────────────
  if (!sub.wf.l1) return null;
  const st  = sub.wfStatus || 'pending_l1';
  const l1n = uName(users, sub.wf.l1);
  const l2n = sub.wf.l2 ? uName(users, sub.wf.l2) : null;
  const l1done     = ['pending_l2','approved'].includes(st);
  const l2done     = st === 'approved' && l2n;
  const rejectedAt = (sub.approvals || []).find(a => a.action === 'rejected');
  function stepSty(active, done, rejected) {
    return { display:'flex', alignItems:'center', gap:8, padding:'10px 13px', borderRadius:8, border:'1.5px solid',
      borderColor: rejected ? '#fca5a5' : done ? '#86efac' : active ? GOLD : '#e5e7eb',
      background:  rejected ? '#fff1f2' : done ? '#f0fdf4' : active ? '#fffbeb' : '#fafafa' };
  }
  function circleColor(done, active, rejected) {
    if (rejected) return '#dc2626'; if (done) return '#059669'; if (active) return GOLD; return '#e5e7eb';
  }
  return (
    <div style={{ marginTop:16, padding:14, background:'#f8faff', border:'1.5px solid #e0e7ff', borderRadius:10 }}>
      <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>Approval Workflow</div>
      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <div style={stepSty(false,true,false)}>
          <div style={{ width:24, height:24, borderRadius:'50%', background:'#059669', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="check" size={12} color="#fff" /></div>
          <div><div style={{ fontSize:11, fontWeight:600, color:'#059669' }}>Submitted</div><div style={{ fontSize:10, color:'#6b7280' }}>{uName(users, sub.submittedBy)}</div></div>
        </div>
        <div style={{ color:'#d1d5db', fontSize:16 }}>→</div>
        <div style={stepSty(st==='pending_l1', l1done, rejectedAt&&rejectedAt.level===1)}>
          <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:circleColor(l1done, st==='pending_l1', rejectedAt&&rejectedAt.level===1) }}>
            {l1done && !(rejectedAt&&rejectedAt.level===1) ? <Icon name="check" size={12} color="#fff" /> : <span style={{ fontSize:11, fontWeight:700, color: st==='pending_l1' ? NAV : '#9ca3af' }}>1</span>}
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color: rejectedAt&&rejectedAt.level===1 ? '#dc2626' : l1done ? '#059669' : st==='pending_l1' ? '#d97706' : '#9ca3af' }}>
              {rejectedAt&&rejectedAt.level===1 ? 'Rejected' : l1done ? 'Approved' : st==='pending_l1' ? 'Awaiting Review' : 'Level 1 Review'}
            </div>
            <div style={{ fontSize:10, color:'#6b7280' }}>{l1n}</div>
          </div>
        </div>
        {l2n && (<><div style={{ color:'#d1d5db', fontSize:16 }}>→</div>
          <div style={stepSty(st==='pending_l2', l2done, rejectedAt&&rejectedAt.level===2)}>
            <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background:circleColor(l2done, st==='pending_l2', rejectedAt&&rejectedAt.level===2) }}>
              {l2done && !(rejectedAt&&rejectedAt.level===2) ? <Icon name="check" size={12} color="#fff" /> : <span style={{ fontSize:11, fontWeight:700, color: st==='pending_l2' ? NAV : '#9ca3af' }}>2</span>}
            </div>
            <div>
              <div style={{ fontSize:11, fontWeight:600, color: rejectedAt&&rejectedAt.level===2 ? '#dc2626' : l2done ? '#059669' : st==='pending_l2' ? '#2563eb' : '#9ca3af' }}>
                {rejectedAt&&rejectedAt.level===2 ? 'Rejected' : l2done ? 'Approved' : st==='pending_l2' ? 'Awaiting Approval' : 'Level 2 Approval'}
              </div>
              <div style={{ fontSize:10, color:'#6b7280' }}>{l2n}</div>
            </div>
          </div>
        </>)}
        {st === 'approved' && (<><div style={{ color:'#d1d5db', fontSize:16 }}>→</div>
          <div style={stepSty(false,true,false)}>
            <div style={{ width:24, height:24, borderRadius:'50%', background:'#059669', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon name="check" size={12} color="#fff" /></div>
            <div style={{ fontSize:11, fontWeight:600, color:'#059669' }}>Fully Approved</div>
          </div>
        </>)}
      </div>
      {rejectedAt && <div style={{ marginTop:10, padding:'8px 11px', background:'#fff1f2', borderRadius:6, fontSize:12, color:'#dc2626' }}><strong>Rejection note:</strong> {rejectedAt.note || 'No note provided.'}</div>}
    </div>
  );
}

// ── File helpers ───────────────────────────────────────────────────────────────
function fileIcon(name) {
  const ext = (name||'').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx','csv'].includes(ext)) return '📊';
  if (['zip','rar','7z'].includes(ext)) return '🗜️';
  return '📎';
}
function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1048576)    return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}

// ── Field renderer ─────────────────────────────────────────────────────────────
function FieldInput({ field, val, onChange, error }) {
  if (field.type === 'checkbox') return (
    <div>
      <label style={{ display:'flex', alignItems:'flex-start', gap:8, cursor:'pointer', fontSize:12.5 }}>
        <input type="checkbox" checked={!!val} onChange={e => onChange(e.target.checked)} style={{ marginTop:3 }} />
        <span>{field.label}{field.req && <span style={{ color:'#dc2626' }}> *</span>}</span>
      </label>
      {error && <div style={{ fontSize:11, color:'#dc2626', marginLeft:21 }}>{error}</div>}
    </div>
  );

  if (field.type === 'file') {
    const files = Array.isArray(val) ? val : [];
    return (
      <div>
        <label style={lbl()}>{field.label}{field.req && <span style={{ color:'#dc2626' }}> *</span>}</label>
        <label style={{ display:'block', padding:'16px', border:`2px dashed ${files.length>0?'#86efac':error?'#fca5a5':'#d1d5db'}`, borderRadius:9, background:files.length>0?'#f0fdf4':error?'#fff1f2':'#fafafa', textAlign:'center', cursor:'pointer', transition:'all 0.2s' }}>
          <input type="file" multiple accept={field.accept||'*/*'} style={{ display:'none' }}
            onChange={e => {
              const newFiles = Array.from(e.target.files).map(f => ({ file:f, name:f.name, size:f.size, status:'pending' }));
              onChange([...files, ...newFiles]);
              e.target.value = '';
            }} />
          <div style={{ fontSize:22, marginBottom:5 }}>📎</div>
          <div style={{ fontSize:13, fontWeight:600, color:NAV }}>Click to attach files</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{field.accept ? `Accepts: ${field.accept}` : 'Any file type'} · Multiple files allowed</div>
        </label>
        {files.length > 0 && (
          <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:5 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:9, padding:'7px 11px', background:'#f9fafb', borderRadius:7, border:'1px solid #e5e7eb' }}>
                <span style={{ fontSize:16 }}>{fileIcon(f.name)}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12.5, fontWeight:500, color:NAV, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize:11, color:'#6b7280' }}>{formatFileSize(f.size)}</div>
                </div>
                <button onClick={() => onChange(files.filter((_,j)=>j!==i))}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#9ca3af', fontSize:18, padding:'0 4px', lineHeight:1 }}>×</button>
              </div>
            ))}
          </div>
        )}
        {error && <div style={{ fontSize:11, color:'#dc2626', marginTop:4 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div>
      <label style={lbl()}>{field.label}{field.req && <span style={{ color:'#dc2626' }}> *</span>}</label>
      {field.type === 'textarea' && <textarea style={{ ...inp(), minHeight:76, resize:'vertical' }} placeholder={field.ph||''} value={val||''} onChange={e => onChange(e.target.value)} />}
      {field.type === 'select'   && <select   style={inp()} value={val||''} onChange={e => onChange(e.target.value)}><option value="">— Select —</option>{(field.options||[]).map(o=><option key={o}>{o}</option>)}</select>}
      {['text','date','number','email'].includes(field.type) && <input style={inp()} type={field.type} placeholder={field.ph||''} value={val||''} onChange={e => onChange(e.target.value)} />}
      {error && <div style={{ fontSize:11, color:'#dc2626', marginTop:2 }}>{error}</div>}
    </div>
  );
}

// ── Attachment display (used in View/Review modals) ────────────────────────────
function AttachmentList({ val, label }) {
  const files = Array.isArray(val) ? val.filter(f => f.url) : [];
  if (files.length === 0) return null;
  return (
    <div style={{ padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
      {label && <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:6 }}>{label}</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {files.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 12px', background:'#f0f4ff', borderRadius:7, border:'1px solid #c7d2fe', textDecoration:'none', transition:'background 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#e0e7ff'}
            onMouseLeave={e=>e.currentTarget.style.background='#f0f4ff'}>
            <span style={{ fontSize:18 }}>{fileIcon(f.name)}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:NAV, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.name}</div>
              {f.size && <div style={{ fontSize:11, color:'#6b7280' }}>{formatFileSize(f.size)}</div>}
            </div>
            <div style={{ fontSize:11, color:'#4f46e5', fontWeight:500, flexShrink:0 }}>
              <Icon name="download" size={13} color="#4f46e5" /> Download
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

// ── View/Print submission modal ────────────────────────────────────────────────
function ViewSubModal({ sub, users, onClose }) {
  const forms = useForms();
  const form  = forms.find(f => f.ref === sub.formRef);
  const sm    = WF_STATUS[sub.wfStatus || 'no_workflow'];
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth:820 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', position:'sticky', top:0, background:'#fff' }}>
          <div>
            <div style={{ fontWeight:700, color:GOLD, fontSize:11 }}>{sub.formRef}</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>{form && form.title}</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>Submitted by {sub.submittedByName} · {new Date(sub.submittedAt).toLocaleString()}</div>
          </div>
          <div style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
            <button style={{ ...btn('green'), padding:'6px 12px', fontSize:12 }} onClick={() => printSubmission(sub, users, forms)}>
              <Icon name="print" size={14} /> Print / PDF
            </button>
            <button style={btn('outline')} onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
        </div>
        <div style={{ padding:'20px 22px' }}>
          <div style={{ marginBottom:4, display:'flex', gap:8, alignItems:'center' }}>
            <span style={pll(FREQ_CLR[form&&form.freq]||'#6b7280')}>{form&&form.freq}</span>
            <span style={bdg(sm.bg, sm.color)}>{sm.label}</span>
          </div>
          <div style={{ height:8 }} />
          {Object.entries(sub.data).map(([k, v]) => {
            if (k.startsWith('_')) return null;
            const field = form && form.fields.find(f => f.id === k);
            // File attachments
            if (field?.type === 'file' || (Array.isArray(v) && v[0]?.url)) {
              return <AttachmentList key={k} val={v} label={field ? field.label : k} />;
            }
            return (
              <div key={k} style={{ padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:1 }}>{field ? field.label : k}</div>
                <div style={{ fontSize:13 }}>{typeof v === 'boolean' ? (v ? '✓ Yes' : '✗ No') : String(v) || '—'}</div>
              </div>
            );
          })}
          <WfBar sub={sub} users={users} />
          {(sub.approvals||[]).length > 0 && (
            <div style={{ marginTop:14, padding:12, background:'#f9fafb', borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Approval History</div>
              {(sub.approvals||[]).map((a,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:6 }}>
                  <span style={bdg(a.action==='approved'?'#d1fae5':'#fee2e2', a.action==='approved'?'#059669':'#dc2626')}>L{a.level} {a.action==='approved'?'Approved':'Rejected'}</span>
                  <div><div style={{ fontSize:12.5, fontWeight:500 }}>{uName(users,a.userId)}</div>{a.note&&<div style={{ fontSize:11, color:'#6b7280' }}>"{a.note}"</div>}<div style={{ fontSize:10, color:'#9ca3af' }}>{new Date(a.at).toLocaleString()}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <button style={{ ...btn('green'), padding:'7px 14px', fontSize:12 }} onClick={() => printSubmission(sub, users, forms)}><Icon name="print" size={14} /> Print / Save as PDF</button>
          <button style={btn('outline')} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
// ── Form fill modal ────────────────────────────────────────────────────────────
function FormFillModal({ form, user, wfConfig, users, onSubmit, onClose, doaConfig }) {
  const [vals, setVals]       = useState({});
  const [errs, setErrs]       = useState({});
  const [done, setDone]       = useState(false);
  const [blockMsg, setBlockMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const isF08     = form.ref === 'F-08';
  const doaSteps  = isF08 ? buildDoaSteps(vals.amount || 0, user.id, users, doaConfig) : [];
  const blocked   = isF08 ? doaBlockReason(user.id, doaConfig) : null;
  const effectiveL1 = user.lineManager || wfConfig?.l1 || null;
  const effectiveL2 = wfConfig?.l2 || null;

  const fileFields = (form.fields || []).filter(f => f.type === 'file');

  function validate() {
    const e = {};
    form.fields.forEach(f => {
      if (f.req && f.type === 'checkbox' && !vals[f.id])                                           e[f.id] = 'Must be checked';
      else if (f.req && f.type === 'file'  && (!Array.isArray(vals[f.id]) || vals[f.id].length===0)) e[f.id] = 'Please attach at least one file';
      else if (f.req && f.type !== 'checkbox' && f.type !== 'file' && (!vals[f.id] || !String(vals[f.id]).trim())) e[f.id] = 'Required';
    });
    setErrs(e); return Object.keys(e).length === 0;
  }

  async function doSubmit() {
    if (blocked) return;
    if (!validate()) return;
    setUploading(true);

    // Upload any file attachments first
    const tempId  = `s${Date.now()}`;
    const finalVals = { ...vals };
    for (const ff of fileFields) {
      const pending = (finalVals[ff.id] || []).filter(f => f.file);
      if (pending.length === 0) continue;
      const uploaded = await Promise.all(pending.map(pf => dbUploadFormAttachment(pf.file, tempId)));
      const successful = uploaded.filter(r => r.url).map(r => ({ url:r.url, name:r.name, size:r.size, type:r.type }));
      const existing  = (finalVals[ff.id] || []).filter(f => f.url); // already uploaded
      finalVals[ff.id] = [...existing, ...successful];
    }

    if (isF08) {
      if (doaSteps.length === 0) { setBlockMsg('Please configure the DoA roles in Workflow Setup before submitting this form.'); setUploading(false); return; }
      await onSubmit({ formRef:form.ref, submittedBy:user.id, submittedByName:user.name, submittedByEmail:user.email, data:finalVals, wf:{ type:'doa', steps:doaSteps, currentStep:0 }, wfStatus:'pending_doa' });
    } else {
      const wfStatus = effectiveL1 ? 'pending_l1' : effectiveL2 ? 'pending_l2' : 'no_workflow';
      await onSubmit({ formRef:form.ref, submittedBy:user.id, submittedByName:user.name, submittedByEmail:user.email, data:finalVals, wf:(effectiveL1||effectiveL2)?{l1:effectiveL1,l2:effectiveL2}:null, wfStatus });
    }
    setUploading(false);
    setDone(true);
  }

  if (done) {
    const firstApprover = isF08
      ? (doaSteps[0] ? uName(users, doaSteps[0].userId) : null)
      : effectiveL1 ? uName(users, effectiveL1) : null;
    return (
      <div style={S.overlay}><div style={{ ...S.modal, maxWidth:400 }}><div style={{ padding:'42px 22px', textAlign:'center' }}>
        <div style={{ width:58, height:58, background:'#d1fae5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}><Icon name="check" size={28} color="#059669" /></div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:NAV, marginBottom:6 }}>Form Submitted</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginBottom:6 }}>{form.ref} — {form.title}</div>
        {firstApprover && <div style={{ fontSize:12, color:'#374151', marginBottom:20 }}>Sent to <strong>{firstApprover}</strong> for review. They have been notified by email.</div>}
        <button style={btn('primary')} onClick={onClose}>Close</button>
      </div></div></div>
    );
  }

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth:820 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', position:'sticky', top:0, background:'#fff' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
              <span style={{ fontWeight:700, color:GOLD, fontSize:11 }}>{form.ref}</span>
              <span style={pll(FREQ_CLR[form.freq]||'#6b7280')}>{form.freq}</span>
              {isF08 && <span style={pll('#7c3aed')}>DoA Routing</span>}
            </div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>{form.title}</div>
            <div style={{ fontSize:10.5, color:'#6b7280', marginTop:1 }}>{form.section}</div>
          </div>
          <button style={btn('outline')} onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div style={{ padding:'20px 22px' }}>

          {/* Blocked message */}
          {blocked && (
            <div style={{ padding:'13px 16px', background:'#fee2e2', border:'1.5px solid #fca5a5', borderRadius:9, marginBottom:16, fontSize:13, color:'#dc2626', fontWeight:500 }}>
              🚫 {blocked}
            </div>
          )}
          {blockMsg && (
            <div style={{ padding:'13px 16px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:9, marginBottom:16, fontSize:13, color:'#92400e' }}>
              ⚠️ {blockMsg}
            </div>
          )}

          {/* Submitter info banner */}
          <div style={{ padding:'10px 14px', background:'#f0f4ff', borderRadius:8, marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:NAV, flexShrink:0 }}>
              {user.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:NAV }}>{user.name}</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>{user.dept} &nbsp;·&nbsp; {user.email}</div>
            </div>
            <div style={{ marginLeft:'auto', fontSize:11, color:'#6b7280' }}>Submitting as logged-in user</div>
          </div>

          {/* F-08 instructions */}
          {isF08 && (
            <div style={{ padding:'12px 14px', background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:8, marginBottom:16, fontSize:12.5, color:'#92400e', lineHeight:1.6 }}>
              <strong>Delegation of Authority:</strong> Routing is determined automatically by the payment amount.
              ≤ ₦50,000: Finance only. &nbsp;₦50,001–₦4,999,999: Line Manager then Finance. &nbsp;₦5M–₦10M: Line Manager, Compliance, MD, Finance. &nbsp;&gt;₦10M: Line Manager, Compliance, MD, Chairman, Finance.
              Finance and Compliance officers cannot initiate this form.
            </div>
          )}

          <div style={{ display:'grid', gap:14 }}>
            {form.fields.map(f => <FieldInput key={f.id} field={f} val={vals[f.id]} onChange={v => setVals(p => ({...p,[f.id]:v}))} error={errs[f.id]} />)}
          </div>

          {/* DoA routing preview for F-08 */}
          {isF08 && !blocked && vals.amount && doaSteps.length > 0 && (
            <div style={{ marginTop:18, padding:14, background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:10 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6d28d9', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>
                Routing for {formatNGN(vals.amount)}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'#6b7280', fontWeight:500 }}>You →</span>
                {doaSteps.map((s, i) => (
                  <span key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {i > 0 && <span style={{ color:'#c4b5fd', fontSize:13 }}>→</span>}
                    <span style={{ padding:'4px 10px', background:'#ede9fe', borderRadius:5, fontSize:11.5, fontWeight:600, color:'#6d28d9' }}>
                      {s.label}: {uName(users, s.userId)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {isF08 && !blocked && vals.amount && doaSteps.length === 0 && (
            <div style={{ marginTop:18, padding:12, background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:9, fontSize:12.5, color:'#92400e' }}>
              ⚠️ DoA roles are not fully configured. Please ask admin to set Finance, Compliance, MD and Chairman in Workflow Setup → DoA Configuration.
            </div>
          )}

          {/* Standard routing preview */}
          {!isF08 && effectiveL1 && (
            <div style={{ marginTop:16, padding:14, background:'#f8faff', border:'1.5px solid #e0e7ff', borderRadius:10 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:10 }}>This form will be routed for approval</div>
              {[
                {n:uName(users,effectiveL1), lv:1, sub:'Line Manager / L1 Reviewer'},
                effectiveL2 ? {n:uName(users,effectiveL2), lv:2, sub:'Final Approver'} : null,
              ].filter(Boolean).map(x => (
                <div key={x.lv} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:'#fff', borderRadius:7, border:'1px solid #e5e7eb', marginBottom:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:NAV, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:GOLD }}>{x.lv}</div>
                  <div><div style={{ fontSize:12.5, fontWeight:600, color:NAV }}>{x.n}</div><div style={{ fontSize:11, color:'#6b7280' }}>{x.sub}</div></div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop:14, padding:11, background:'#f9fafb', borderRadius:7, fontSize:11, color:'#6b7280' }}>
            <strong>Submitted by:</strong> {user.name} &nbsp;·&nbsp; <strong>Date:</strong> {new Date().toLocaleDateString()}
          </div>
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
          <button style={{ ...btn('outline') }} onClick={onClose} disabled={uploading}>Cancel</button>
          <button style={{ ...btn('gold'), opacity:(blocked||uploading)?0.4:1 }} onClick={doSubmit} disabled={!!blocked||uploading}>
            {uploading ? '⏳ Uploading & Submitting...' : <><Icon name="check" size={14} /> Submit Form</>}
          </button>
        </div>
      </div>
    </div>
  );
}
// ── Review modal ───────────────────────────────────────────────────────────────
function ReviewModal({ sub, currentUser, users, onAction, onClose }) {
  const forms   = useForms();
  const form    = forms.find(f => f.ref === sub.formRef);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(null);

  const isDoA      = sub.wf?.type === 'doa';
  const doaIdx     = sub.wf?.currentStep ?? 0;
  const doaStep    = isDoA ? sub.wf?.steps?.[doaIdx] : null;
  const isDoaActor = isDoA && doaStep?.userId === currentUser.id && sub.wfStatus === 'pending_doa';
  const isL1       = sub.wfStatus === 'pending_l1' && sub.wf?.l1 === currentUser.id;
  const isL2       = sub.wfStatus === 'pending_l2' && sub.wf?.l2 === currentUser.id;
  const canAct     = isL1 || isL2 || isDoaActor;
  const level      = isL1 ? 1 : isL2 ? 2 : 0;

  function act(action) {
    if (action === 'rejected' && !note.trim()) { alert('Please add a rejection note.'); return; }
    onAction(sub.id, action, isDoA ? 'doa' : level, note, doaIdx);
    setDone(action);
  }

  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...S.modal, maxWidth:820 }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', position:'sticky', top:0, background:'#fff' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
              <span style={{ fontWeight:700, color:GOLD, fontSize:11 }}>{sub.formRef}</span>
              {isDoaActor && doaStep && <span style={bdg('#ede9fe','#6d28d9')}>Awaiting your {doaStep.role} review</span>}
              {!isDoA && canAct && <span style={bdg('#fef3c7','#92400e')}>Awaiting your {level===1?'review':'approval'}</span>}
            </div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>{form&&form.title}</div>
            <div style={{ fontSize:11, color:'#6b7280' }}>Submitted by {sub.submittedByName} · {new Date(sub.submittedAt).toLocaleString()}</div>
          </div>
          <div style={{ display:'flex', gap:9 }}>
            <button style={{ ...btn('green'), padding:'6px 12px', fontSize:12 }} onClick={() => printSubmission(sub, users, forms)}><Icon name="print" size={14} /> Print</button>
            <button style={btn('outline')} onClick={onClose}><Icon name="x" size={14} /></button>
          </div>
        </div>
        <div style={{ padding:'20px 22px' }}>
          {Object.entries(sub.data).map(([k, v]) => {
            if (k.startsWith('_')) return null;
            const field = form&&form.fields.find(f=>f.id===k);
            if (field?.type === 'file' || (Array.isArray(v) && v[0]?.url)) {
              return <AttachmentList key={k} val={v} label={field ? field.label : k} />;
            }
            return (
              <div key={k} style={{ padding:'7px 0', borderBottom:'1px solid #f3f4f6' }}>
                <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:1 }}>{field?field.label:k}</div>
                <div style={{ fontSize:13 }}>{typeof v==='boolean'?(v?'✓ Yes':'✗ No'):String(v)||'—'}</div>
              </div>
            );
          })}
          <WfBar sub={sub} users={users} />
          {(sub.approvals||[]).length > 0 && (
            <div style={{ marginTop:14, padding:12, background:'#f9fafb', borderRadius:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>Approval History</div>
              {(sub.approvals||[]).map((a,i) => {
                const lbl2 = a.role || (a.level===1?'L1 Review':'L2 Approval');
                const clr  = a.action==='approved'?'#059669':a.action==='rerouted'?'#6d28d9':'#dc2626';
                const bg2  = a.action==='approved'?'#d1fae5':a.action==='rerouted'?'#ede9fe':'#fee2e2';
                return (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:6 }}>
                    <span style={bdg(bg2,clr)}>{lbl2} — {a.action==='approved'?'Approved':a.action==='rerouted'?'Re-routed':'Rejected'}</span>
                    <div><div style={{ fontSize:12.5, fontWeight:500 }}>{uName(users,a.userId)}</div>{a.note&&<div style={{ fontSize:11, color:'#6b7280' }}>"{a.note}"</div>}<div style={{ fontSize:10, color:'#9ca3af' }}>{new Date(a.at).toLocaleString()}</div></div>
                  </div>
                );
              })}
            </div>
          )}
          {canAct && !done && (
            <div style={{ marginTop:16, padding:14, background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:9 }}>
              <div style={{ fontWeight:600, fontSize:13, color:NAV, marginBottom:10 }}>
                Your Action — {isDoaActor && doaStep ? doaStep.label : level===1?'Level 1 Review':'Level 2 Approval'}
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={lbl()}>Note (required if rejecting)</label>
                <textarea style={{ ...inp(), minHeight:60, resize:'vertical' }} value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note for the submitter or next approver..." />
              </div>
              <div style={{ display:'flex', gap:9 }}>
                <button style={btn('gold')} onClick={()=>act('approved')}><Icon name="check" size={14} /> Approve</button>
                <button style={btn('danger')} onClick={()=>act('rejected')}>Reject</button>
              </div>
            </div>
          )}
          {done && (
            <div style={{ marginTop:16, padding:14, background:done==='approved'?'#f0fdf4':'#fff1f2', border:`1.5px solid ${done==='approved'?'#86efac':'#fca5a5'}`, borderRadius:9, display:'flex', alignItems:'center', gap:10 }}>
              <Icon name="check" size={20} color={done==='approved'?'#059669':'#dc2626'} />
              <div style={{ fontWeight:600, color:done==='approved'?'#059669':'#dc2626' }}>Form {done==='approved'?'approved':'rejected'} successfully.</div>
            </div>
          )}
        </div>
        <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end' }}>
          <button style={btn('outline')} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ user, policies, signoffs, submissions }) {
  const forms      = useForms();
  const mySigns    = signoffs.filter(s => s.user_id === user.id);
  const pending    = policies.filter(p => (!p.status || p.status === 'active') && !mySigns.find(s => s.policy_id === p.id));
  const myForms    = submissions.filter(s => s.submittedBy === user.id).slice(0, 5);
  const inboxCount = submissions.filter(s => getApprover(s) === user.id).length;
  return (
    <div style={S.page}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:23, color:NAV }}>Welcome, {user.name.split(' ')[0]}</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:3 }}>{user.dept} · {user.role==='admin'?'Administrator':'Staff'} · {new Date().toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:13, marginBottom:22 }}>
        {[
          { label:'Policies Signed',           v:mySigns.length, tot:policies.length, c:'#059669' },
          { label:'Pending Acknowledgements',   v:pending.length, c:pending.length>0?'#dc2626':'#059669' },
          { label:'Forms Submitted',            v:submissions.filter(s=>s.submittedBy===user.id).length, c:'#2563eb' },
          { label:'Inbox — Awaiting My Action', v:inboxCount, c:inboxCount>0?'#d97706':NAV },
        ].map((s,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:10, padding:18, borderLeft:`4px solid ${s.c}`, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:28, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}{s.tot?<span style={{ fontSize:16, color:'#9ca3af' }}>/{s.tot}</span>:''}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ ...S.card, padding:18 }}>
          <div style={{ fontWeight:600, fontSize:12.5, marginBottom:13, display:'flex', alignItems:'center', gap:6 }}><Icon name="bell" size={14} color="#dc2626" /> Pending Policy Acknowledgements</div>
          {pending.length===0 ? <div style={{ textAlign:'center', padding:'18px 0', color:'#059669', fontSize:12.5 }}>All policies acknowledged!</div>
          : pending.map(p => (<div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
            <div><div style={{ fontSize:12.5, fontWeight:500 }}>{p.title}</div><div style={{ fontSize:11, color:'#6b7280' }}>{p.category} · {p.version}</div></div>
            <span style={bdg('#fee2e2','#dc2626')}>Pending</span>
          </div>))}
        </div>
        <div style={{ ...S.card, padding:18 }}>
          <div style={{ fontWeight:600, fontSize:12.5, marginBottom:13, display:'flex', alignItems:'center', gap:6 }}><Icon name="form" size={14} color={NAV} /> Recent Form Submissions</div>
          {myForms.length===0 ? <div style={{ textAlign:'center', padding:'18px 0', color:'#6b7280', fontSize:12.5 }}>No forms submitted yet.</div>
          : myForms.map(s => { const f=forms.find(f=>f.ref===s.formRef); const sm=WF_STATUS[s.wfStatus||'no_workflow']; return (
            <div key={s.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
              <div><div style={{ fontSize:12.5, fontWeight:500 }}>{f&&f.ref} — {f&&f.title&&f.title.slice(0,26)}{f&&f.title&&f.title.length>26?'…':''}</div><div style={{ fontSize:11, color:'#6b7280' }}>{new Date(s.submittedAt).toLocaleDateString()}</div></div>
              <span style={bdg(sm.bg,sm.color)}>{sm.label}</span>
            </div>
          );})}
        </div>
      </div>
    </div>
  );
}

// ── Policies ───────────────────────────────────────────────────────────────────
function Policies({ user, policies, setPolicies, signoffs, setSignoffs }) {
  const [sel, setSel]               = useState(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null); // policy to archive
  const [newVersionFor, setNewVersionFor] = useState(null); // policy being replaced
  const [q, setQ]                   = useState('');
  const [uploading, setUploading]   = useState(false);
  const [uploadMode, setUploadMode] = useState('file');
  const [uploadFile, setUploadFile] = useState(null);
  const [np, setNp]                 = useState({ title:'', category:'Governance', version:'v1.0', content:'' });
  const [archiveNote, setArchiveNote] = useState('');

  const catClr = { Governance:'#7c3aed', Compliance:'#059669', IT:'#2563eb', Trading:'#d97706', Operations:'#dc2626', HR:'#0891b2', Risk:'#9333ea' };

  const active   = policies.filter(p => (!p.status || p.status === 'active') && (p.title.toLowerCase().includes(q.toLowerCase()) || p.category.toLowerCase().includes(q.toLowerCase())));
  const archived = policies.filter(p => p.status === 'archived');

  // ── Sign off ──────────────────────────────────────────────────────────────
  async function signPolicy(policyId, policyTitle, policyVersion) {
    await dbAddSignoff({ policyId, policyTitle, policyVersion, userId:user.id, userName:user.name });
    setSignoffs(prev => [...prev, {
      policy_id:      policyId,
      policy_title:   policyTitle,
      policy_version: policyVersion,
      user_id:        user.id,
      user_name:      user.name,
      signed_at:      new Date().toISOString(),
    }]);
  }

  // ── Add brand-new policy ──────────────────────────────────────────────────
  async function addPolicy() {
    if (!np.title) return;
    if (uploadMode === 'file' && !uploadFile) return;
    if (uploadMode === 'text' && !np.content) return;
    setUploading(true);

    let fileUrl = null, fileName = null, fileType = null;
    if (uploadMode === 'file' && uploadFile) {
      const r = await dbUploadPolicyFile(uploadFile);
      if (r.error) { alert('File upload failed. Please try again.'); setUploading(false); return; }
      fileUrl = r.url; fileName = r.fileName; fileType = r.fileType;
    }

    const id = `p${Date.now()}`;
    const { error } = await dbAddPolicy({ id, title:np.title, category:np.category, version:np.version, content:np.content, fileUrl, fileName, fileType });
    if (!error) {
      setPolicies(prev => [...prev, { id, title:np.title, category:np.category, version:np.version, date:new Date().toISOString().split('T')[0], content:np.content, file_url:fileUrl, file_name:fileName, file_type:fileType, status:'active' }]);
    }
    setShowAdd(false); setNp({ title:'', category:'Governance', version:'v1.0', content:'' }); setUploadFile(null); setUploading(false);
  }

  // ── Upload new version (archives old) ────────────────────────────────────
  async function uploadNewVersion() {
    if (!np.title) return;
    if (uploadMode === 'file' && !uploadFile) return;
    if (uploadMode === 'text' && !np.content) return;
    setUploading(true);

    let fileUrl = null, fileName = null, fileType = null;
    if (uploadMode === 'file' && uploadFile) {
      const r = await dbUploadPolicyFile(uploadFile);
      if (r.error) { alert('File upload failed. Please try again.'); setUploading(false); return; }
      fileUrl = r.url; fileName = r.fileName; fileType = r.fileType;
    }

    const { newId, error } = await dbNewVersion({
      oldId:       newVersionFor.id,
      archiveNote: archiveNote || `Superseded by ${np.version}`,
      newPolicy:   { title:np.title, category:np.category, version:np.version, content:np.content, fileUrl, fileName, fileType },
    });

    if (!error) {
      // Mark old as archived in local state
      setPolicies(prev => prev.map(p => p.id === newVersionFor.id
        ? { ...p, status:'archived', archived_at:new Date().toISOString(), superseded_by:newId }
        : p
      ).concat([{
        id: newId, title:np.title, category:np.category, version:np.version,
        date:new Date().toISOString().split('T')[0], content:np.content,
        file_url:fileUrl, file_name:fileName, file_type:fileType, status:'active',
      }]));
    }
    setNewVersionFor(null); setNp({ title:'', category:'Governance', version:'v1.0', content:'' }); setUploadFile(null); setArchiveNote(''); setUploading(false);
  }

  // ── Archive without replacement ───────────────────────────────────────────
  async function confirmArchive() {
    if (!archiveTarget) return;
    const { error } = await dbArchivePolicy({ id:archiveTarget.id, note:archiveNote });
    if (!error) {
      setPolicies(prev => prev.map(p => p.id === archiveTarget.id
        ? { ...p, status:'archived', archived_at:new Date().toISOString() }
        : p
      ));
    }
    setArchiveTarget(null); setArchiveNote('');
  }

  // ── Policy form UI (shared between Add and New Version) ──────────────────
  function PolicyForm({ title, onSubmit, onCancel }) {
    return (
      <div style={S.overlay}>
        <div style={{ ...S.modal, maxWidth:560 }}>
          <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between' }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>{title}</div>
            <button style={btn('outline')} onClick={onCancel} disabled={uploading}><Icon name="x" size={14} /></button>
          </div>
          <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
            <div>
              <label style={lbl()}>Policy Title *</label>
              <input style={inp()} value={np.title} onChange={e=>setNp({...np,title:e.target.value})} placeholder="e.g. Anti-Money Laundering Policy" />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={lbl()}>Category</label>
                <select style={inp()} value={np.category} onChange={e=>setNp({...np,category:e.target.value})}>
                  {Object.keys(catClr).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl()}>Version</label>
                <input style={inp()} value={np.version} onChange={e=>setNp({...np,version:e.target.value})} placeholder="e.g. v3.0" />
              </div>
            </div>
            <div>
              <label style={lbl()}>Policy Content *</label>
              <div style={{ display:'flex', gap:0, borderRadius:7, overflow:'hidden', border:'1.5px solid #d1d5db', marginBottom:12 }}>
                <button onClick={()=>setUploadMode('file')} style={{ flex:1, padding:'8px 0', fontFamily:'inherit', fontSize:12.5, fontWeight:500, cursor:'pointer', border:'none', background:uploadMode==='file'?NAV:'#f9fafb', color:uploadMode==='file'?'#fff':'#374151' }}>
                  Upload PDF or Word File
                </button>
                <button onClick={()=>setUploadMode('text')} style={{ flex:1, padding:'8px 0', fontFamily:'inherit', fontSize:12.5, fontWeight:500, cursor:'pointer', border:'none', background:uploadMode==='text'?NAV:'#f9fafb', color:uploadMode==='text'?'#fff':'#374151' }}>
                  Paste as Text
                </button>
              </div>
              {uploadMode === 'file' && (
                <div>
                  <label style={{ display:'block', padding:'24px 16px', border:`2px dashed ${uploadFile?'#059669':'#d1d5db'}`, borderRadius:9, background:uploadFile?'#f0fdf4':'#fafafa', textAlign:'center', cursor:'pointer' }}>
                    <input type="file" accept=".pdf,.doc,.docx" style={{ display:'none' }} onChange={e=>{ const f=e.target.files[0]; if(f) setUploadFile(f); }} />
                    {uploadFile ? (
                      <div>
                        <div style={{ fontSize:22, marginBottom:6 }}>{uploadFile.name.endsWith('.pdf')?'📄':'📝'}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:'#059669' }}>{uploadFile.name}</div>
                        <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{(uploadFile.size/1024).toFixed(0)} KB — click to change</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize:28, marginBottom:8 }}>📎</div>
                        <div style={{ fontSize:13, fontWeight:600, color:NAV }}>Click to select file</div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>Supports PDF and Word (.docx) files</div>
                      </div>
                    )}
                  </label>
                  {uploadFile && (
                    <div style={{ marginTop:8 }}>
                      <label style={lbl()}>Optional: Add a text summary</label>
                      <textarea style={{ ...inp(), minHeight:60, resize:'vertical' }} value={np.content} onChange={e=>setNp({...np,content:e.target.value})} placeholder="Brief description or key points (optional)..." />
                    </div>
                  )}
                </div>
              )}
              {uploadMode === 'text' && (
                <textarea style={{ ...inp(), minHeight:160, resize:'vertical' }} value={np.content} onChange={e=>setNp({...np,content:e.target.value})} placeholder="Paste or type the full policy text here..." />
              )}
            </div>
            {newVersionFor && (
              <div>
                <label style={lbl()}>Archive Note (optional)</label>
                <input style={inp()} value={archiveNote} onChange={e=>setArchiveNote(e.target.value)} placeholder={`e.g. Superseded by updated ${np.version || 'version'}`} />
              </div>
            )}
          </div>
          <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end', alignItems:'center' }}>
            {uploading && <span style={{ fontSize:12, color:'#6b7280' }}>Saving...</span>}
            <button style={btn('outline')} onClick={onCancel} disabled={uploading}>Cancel</button>
            <button style={{ ...btn('primary'), opacity:uploading?0.6:1 }} onClick={onSubmit} disabled={uploading}>
              {uploading ? 'Saving...' : newVersionFor ? 'Archive Old & Publish New Version' : 'Save Policy'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:NAV }}>Policy Library</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Read and acknowledge all active policies</div>
        </div>
        {user.role === 'admin' && (
          <button style={btn('primary')} onClick={() => { setNewVersionFor(null); setNp({ title:'', category:'Governance', version:'v1.0', content:'' }); setUploadFile(null); setUploadMode('file'); setShowAdd(true); }}>
            <Icon name="plus" size={14} /> Add Policy
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ marginBottom:14, display:'flex', gap:10, alignItems:'center' }}>
        <input style={{ ...inp(), maxWidth:300 }} placeholder="Search policies..." value={q} onChange={e=>setQ(e.target.value)} />
        {user.role === 'admin' && (
          <button style={{ ...btn(showArchived ? 'primary' : 'outline'), padding:'8px 14px', fontSize:12 }}
            onClick={() => setShowArchived(!showArchived)}>
            <Icon name="eye" size={13} /> {showArchived ? 'Hide Archived' : `View Archived (${archived.length})`}
          </button>
        )}
      </div>

      {/* Active policies table */}
      <div style={{ ...S.card, overflow:'hidden', marginBottom: showArchived ? 24 : 0 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr>
              <Th>Policy Title</Th><Th>Category</Th><Th>Version</Th><Th>Format</Th>
              <Th>Acknowledgement Status</Th>
              {user.role === 'admin' && <Th>Actions</Th>}
              {user.role !== 'admin' && <Th></Th>}
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign:'center', color:'#6b7280', padding:34 }}>No active policies found.</td></tr>
            )}
            {active.map(p => {
              const signed   = signoffs.find(s => s.policy_id === p.id && s.user_id === user.id);
              const cc       = catClr[p.category] || '#6b7280';
              const fmt      = p.file_type ? p.file_type.toUpperCase() : 'Text';
              const fmtColor = p.file_type === 'pdf' ? '#dc2626' : p.file_type === 'docx' ? '#2563eb' : '#6b7280';
              return (
                <tr key={p.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <Td style={{ fontWeight:500, color:NAV }}>{p.title}</Td>
                  <Td><span style={bdg(`${cc}22`, cc)}>{p.category}</span></Td>
                  <Td style={{ color:'#6b7280' }}>{p.version}</Td>
                  <Td><span style={bdg(`${fmtColor}18`, fmtColor)}>{fmt}</span></Td>
                  <Td>
                    {signed
                      ? <span style={bdg('#d1fae5','#059669')}>Signed {new Date(signed.signed_at).toLocaleDateString()}</span>
                      : <span style={bdg('#fee2e2','#dc2626')}>Pending</span>}
                  </Td>
                  <Td>
                    <div style={{ display:'flex', gap:7 }}>
                      <button style={{ ...btn('outline'), padding:'5px 11px', fontSize:11 }} onClick={() => setSel(p)}>
                        <Icon name="eye" size={12} /> View
                      </button>
                      {user.role === 'admin' && (<>
                        <button
                          style={{ ...btn('outline'), padding:'5px 11px', fontSize:11, color:'#2563eb', borderColor:'#bfdbfe' }}
                          onClick={() => {
                            setNewVersionFor(p);
                            setNp({ title:p.title, category:p.category, version:'', content:'' });
                            setUploadFile(null); setUploadMode('file'); setArchiveNote('');
                          }}>
                          New Version
                        </button>
                        <button
                          style={{ ...btn('outline'), padding:'5px 11px', fontSize:11, color:'#dc2626', borderColor:'#fecaca' }}
                          onClick={() => { setArchiveTarget(p); setArchiveNote(''); }}>
                          Archive
                        </button>
                      </>)}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Archived policies — admin only */}
      {user.role === 'admin' && showArchived && archived.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
            <Icon name="doc" size={14} color="#6b7280" /> Archived Policies — {archived.length} record{archived.length > 1 ? 's' : ''} (audit trail preserved)
          </div>
          <div style={{ ...S.card, overflow:'hidden', border:'1.5px solid #e5e7eb' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  <Th>Policy Title</Th><Th>Version</Th><Th>Category</Th><Th>Archived On</Th><Th>Note</Th><Th>Signoffs</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {archived.map(p => {
                  const sigCount = signoffs.filter(s => s.policy_id === p.id).length;
                  const supersededBy = p.superseded_by ? policies.find(x => x.id === p.superseded_by) : null;
                  return (
                    <tr key={p.id} style={{ borderBottom:'1px solid #f3f4f6', opacity:0.85 }}>
                      <Td style={{ color:'#6b7280' }}>
                        <div style={{ fontWeight:500 }}>{p.title}</div>
                        {supersededBy && <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>Superseded by {supersededBy.version}</div>}
                      </Td>
                      <Td style={{ color:'#9ca3af' }}>{p.version}</Td>
                      <Td><span style={bdg('#f3f4f6','#6b7280')}>{p.category}</span></Td>
                      <Td style={{ color:'#9ca3af', fontSize:11 }}>{p.archived_at ? new Date(p.archived_at).toLocaleDateString() : '—'}</Td>
                      <Td style={{ color:'#9ca3af', fontSize:11, maxWidth:160 }}>{p.archived_note || '—'}</Td>
                      <Td>
                        <span style={bdg('#f3f4f6','#6b7280')}>{sigCount} signoff{sigCount !== 1 ? 's' : ''}</span>
                      </Td>
                      <Td>
                        <button style={{ ...btn('outline'), padding:'5px 11px', fontSize:11 }} onClick={() => setSel(p)}>
                          <Icon name="eye" size={12} /> View
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Policy viewer */}
      {sel && (
        <PolicyModal policy={sel} user={user} signoffs={signoffs}
          onSign={signPolicy} onClose={() => setSel(null)} />
      )}

      {/* Add new policy modal */}
      {showAdd && (
        <PolicyForm
          title="Add New Policy"
          onSubmit={addPolicy}
          onCancel={() => { setShowAdd(false); setUploadFile(null); }} />
      )}

      {/* New version modal */}
      {newVersionFor && (
        <PolicyForm
          title={`New Version — ${newVersionFor.title}`}
          onSubmit={uploadNewVersion}
          onCancel={() => { setNewVersionFor(null); setUploadFile(null); setArchiveNote(''); }} />
      )}

      {/* Archive confirmation modal */}
      {archiveTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:460 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Archive Policy</div>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <div style={{ padding:'14px 16px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:8, marginBottom:16, fontSize:13, color:'#92400e' }}>
                <strong>This will archive:</strong> {archiveTarget.title} ({archiveTarget.version})
              </div>
              <p style={{ fontSize:13, color:'#374151', marginBottom:16, lineHeight:1.6 }}>
                The policy will be hidden from staff but <strong>all signoff records are permanently preserved</strong> in the audit trail. Staff who already signed it will retain their acknowledgement record.
              </p>
              <div>
                <label style={lbl()}>Archive Note (optional)</label>
                <input style={inp()} value={archiveNote} onChange={e => setArchiveNote(e.target.value)} placeholder="e.g. Policy withdrawn — under revision" />
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
              <button style={btn('outline')} onClick={() => { setArchiveTarget(null); setArchiveNote(''); }}>Cancel</button>
              <button style={{ ...btn('danger'), background:'#dc2626', color:'#fff' }} onClick={confirmArchive}>
                Archive Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Forms module ───────────────────────────────────────────────────────────────
function Forms({ user, submissions, setSubmissions, wfConfigs, users, formConfigs, setFormConfigs, doaConfig }) {
  const forms = useForms();
  const [sel, setSel]               = useState(null);
  const [viewSub, setViewSub]       = useState(null);
  const [freqF, setFreqF]           = useState('All');
  const [q, setQ]                   = useState('');
  const [tab, setTab]               = useState('catalog');
  const [showArchived, setShowArchived] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [archiveNote,   setArchiveNote]   = useState('');
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [shareTarget,   setShareTarget]   = useState(null);  // form being shared
  const [fRef,    setFRef]    = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fUser,   setFUser]   = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  const freqs = ['All','Daily','Weekly','Monthly','Quarterly','Annual','Per trade','Per payment','As required','Continuous'];
  const archivedRefs  = new Set(Object.entries(formConfigs).filter(([,v])=>v.archived).map(([k])=>k));
  const activeForms   = forms.filter(f => !archivedRefs.has(f.ref));
  const archivedForms = forms.filter(f =>  archivedRefs.has(f.ref));
  const filteredCatalog = activeForms.filter(f =>
    (freqF==='All'||f.freq===freqF||f.freq.includes(freqF)) &&
    (f.title.toLowerCase().includes(q.toLowerCase())||f.ref.toLowerCase().includes(q.toLowerCase()))
  );
  const baseSubs = user.role==='admin' ? submissions : submissions.filter(s=>s.submittedBy===user.id);
  const filteredSubs = baseSubs.filter(s => {
    if (fRef    && !s.formRef.toLowerCase().includes(fRef.toLowerCase()) && !(forms.find(f=>f.ref===s.formRef)?.title||'').toLowerCase().includes(fRef.toLowerCase())) return false;
    if (fStatus && (s.wfStatus||'no_workflow')!==fStatus) return false;
    if (fUser   && s.submittedBy!==fUser) return false;
    if (fFrom   && new Date(s.submittedAt)<new Date(fFrom)) return false;
    if (fTo     && new Date(s.submittedAt)>new Date(fTo+'T23:59:59')) return false;
    return true;
  });
  const hasFilters = fRef||fStatus||fUser||fFrom||fTo;

  const handleSubmit = useCallback(async ({ formRef, submittedBy, submittedByName, submittedByEmail, data, wf, wfStatus }) => {
    const id = `s${Date.now()}`;
    await dbAddSubmission({ id, formRef, submittedBy, submittedByName, data, wf, wfStatus });
    const newSub = { id, formRef, submittedBy, submittedByName, submittedAt:new Date().toISOString(), data, wf, wfStatus, approvals:[] };
    setSubmissions(prev => [newSub, ...prev]);

    const form = forms.find(f => f.ref === formRef);

    // Work out who the first approver is so we can mention them in the receipt
    let firstApproverName = null;
    if (wf?.type === 'doa') {
      firstApproverName = uName(users, wf.steps?.[0]?.userId);
    } else if (wf?.l1) {
      firstApproverName = uName(users, wf.l1);
    }

    // Send receipt to submitter via dedicated /api/receipt endpoint
    if (submittedByEmail) {
      console.log('[Portal] Calling /api/receipt for:', submittedByEmail, '| form:', formRef, '| approver:', firstApproverName);
      try {
        const r = await fetch('/api/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to:           submittedByEmail,
            toName:       submittedByName,
            formRef,
            formTitle:    form?.title || formRef,
            approverName: firstApproverName,
            portalUrl:    window.location.origin,
          }),
        });
        const d = await r.json();
        console.log('[Portal] /api/receipt response:', d);
      } catch (e) {
        console.warn('[Portal] /api/receipt error:', e.message);
      }
    } else {
      console.warn('[Portal] Receipt skipped — no email for submitter', submittedBy);
    }

    // Notify first approver
    if (wf?.type === 'doa') {
      const firstStep = wf.steps?.[0];
      if (firstStep) await sendNotify({ to:uEmail(users,firstStep.userId), toName:uName(users,firstStep.userId), fromName:submittedByName, formRef, formTitle:form?.title||formRef, level:1 });
    } else if (wf?.l1) {
      await sendNotify({ to:uEmail(users,wf.l1), toName:uName(users,wf.l1), fromName:submittedByName, formRef, formTitle:form?.title||formRef, level:1 });
    }
  }, [users, setSubmissions, forms]);

  async function doArchive() {
    if (!archiveTarget) return;
    setArchiveSaving(true);
    const { error } = await dbArchiveForm({ formRef:archiveTarget.ref, note:archiveNote });
    if (!error) setFormConfigs(prev => ({ ...prev, [archiveTarget.ref]:{ form_ref:archiveTarget.ref, archived:true, archived_at:new Date().toISOString(), archived_note:archiveNote } }));
    setArchiveTarget(null); setArchiveNote(''); setArchiveSaving(false);
  }
  async function doRestore(ref) {
    await dbRestoreForm(ref);
    setFormConfigs(prev => ({ ...prev, [ref]:{ ...(prev[ref]||{}), archived:false, archived_at:null } }));
  }

  async function togglePublic(ref, current) {
    const next = !current;
    await dbSetFormPublic({ formRef:ref, isPublic:next });
    setFormConfigs(prev => ({ ...prev, [ref]:{ ...(prev[ref]||{}), public_access:next } }));
    if (next) {
      // Show share modal after enabling
      const form = forms.find(f => f.ref === ref);
      if (form) setShareTarget(form);
    }
  }

  const tabStyle = active => ({ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', cursor:'pointer', fontSize:12.5, borderBottom:`2.5px solid ${active?GOLD:'transparent'}`, color:active?NAV:'#6b7280', fontWeight:500 });

  return (
    <div style={S.page}>
      <div style={{ marginBottom:18 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:NAV }}>Forms and Templates</div>
        <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Complete and submit operational control forms</div>
      </div>
      <div style={{ display:'flex', gap:0, borderBottom:'1.5px solid #e5e7eb', marginBottom:18 }}>
        <div style={tabStyle(tab==='catalog')}     onClick={()=>setTab('catalog')}><Icon name="form" size={13} /> Form Catalog</div>
        <div style={tabStyle(tab==='submissions')} onClick={()=>setTab('submissions')}><Icon name="check" size={13} /> Submissions</div>
      </div>

      {tab==='catalog' && (
        <>
          <div style={{ display:'flex', gap:9, marginBottom:16, flexWrap:'wrap', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ display:'flex', gap:9, flexWrap:'wrap', alignItems:'center' }}>
              <input style={{ ...inp(), width:220 }} placeholder="Search forms..." value={q} onChange={e=>setQ(e.target.value)} />
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{freqs.map(f=><button key={f} onClick={()=>setFreqF(f)} style={{ ...btn(), padding:'5px 10px', fontSize:11, background:freqF===f?NAV:'#fff', color:freqF===f?'#fff':'#374151', border:'1.5px solid', borderColor:freqF===f?NAV:'#d1d5db' }}>{f}</button>)}</div>
            </div>
            {user.role==='admin' && <button style={{ ...btn(showArchived?'primary':'outline'), padding:'7px 13px', fontSize:12 }} onClick={()=>setShowArchived(!showArchived)}><Icon name="eye" size={13} /> {showArchived?'Hide Archived':`Archived (${archivedForms.length})`}</button>}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:11 }}>
            {filteredCatalog.map(form => {
              const wf       = wfConfigs[form.ref];
              const l1n      = wf && wf.l1 ? uName(users, wf.l1) : null;
              const l2n      = wf && wf.l2 ? uName(users, wf.l2) : null;
              const cfg      = formConfigs[form.ref] || {};
              const isPublic = cfg.public_access === true;
              return (
                <div key={form.ref} style={{ ...S.card, padding:16, transition:'box-shadow 0.15s' }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 14px rgba(0,0,0,0.1)'}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow=''}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:7 }}>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontWeight:700, color:GOLD, fontSize:11 }}>{form.ref}</span>
                      <span style={pll(FREQ_CLR[form.freq]||'#6b7280')}>{form.freq}</span>
                      {isPublic && <span style={pll('#059669')}>Public</span>}
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ fontSize:10, color:'#9ca3af' }}>{form.fields.length} fields</span>
                      {user.role==='admin' && (
                        <button style={{ ...btn('outline'), padding:'3px 8px', fontSize:10, color:'#dc2626', borderColor:'#fecaca' }}
                          onClick={()=>{setArchiveTarget(form);setArchiveNote('');}}>Archive</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontWeight:600, fontSize:13, color:NAV, marginBottom:3 }}>{form.title}</div>
                  <div style={{ fontSize:11, color:'#6b7280', marginBottom:l1n?8:11 }}>{form.section}</div>
                  {l1n && (
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:10, padding:'5px 8px', background:'#f0f4ff', borderRadius:5 }}>
                      <Icon name="flow" size={12} color="#4f46e5" />
                      <span style={{ fontSize:11, color:'#4f46e5' }}>{l1n}{l2n ? ` → ${l2n}` : ''}</span>
                    </div>
                  )}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:6 }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {user.role === 'admin' && (
                        <>
                          <button
                            style={{ ...btn(isPublic?'gold':'outline'), padding:'5px 10px', fontSize:11 }}
                            onClick={() => togglePublic(form.ref, isPublic)}
                            title={isPublic ? 'Disable public access' : 'Enable public access'}>
                            {isPublic ? '🔓 Public On' : '🔒 Make Public'}
                          </button>
                          {isPublic && (
                            <button style={{ ...btn('outline'), padding:'5px 10px', fontSize:11, color:'#059669', borderColor:'#86efac' }}
                              onClick={() => setShareTarget(form)}>
                              Share / Embed
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <button style={{ ...btn('primary'), padding:'5px 12px', fontSize:11 }} onClick={()=>setSel(form)}>
                      <Icon name="form" size={12} /> Complete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {user.role==='admin' && showArchived && archivedForms.length>0 && (
            <div style={{ marginTop:24 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Archived Forms — hidden from staff</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:11 }}>
                {archivedForms.map(form => {
                  const cfg=formConfigs[form.ref]; const subCount=submissions.filter(s=>s.formRef===form.ref).length;
                  return (
                    <div key={form.ref} style={{ ...S.card, padding:16, opacity:0.75, border:'1.5px solid #e5e7eb' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}><span style={{ fontWeight:700, color:'#9ca3af', fontSize:11 }}>{form.ref}</span><span style={bdg('#f3f4f6','#9ca3af')}>Archived</span></div>
                        <button style={{ ...btn('outline'), padding:'3px 8px', fontSize:10, color:'#059669', borderColor:'#86efac' }} onClick={()=>doRestore(form.ref)}>Restore</button>
                      </div>
                      <div style={{ fontWeight:600, fontSize:13, color:'#6b7280', marginBottom:2 }}>{form.title}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginBottom:4 }}>{form.section}</div>
                      {cfg?.archived_note && <div style={{ fontSize:11, color:'#9ca3af' }}>Note: {cfg.archived_note}</div>}
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{subCount} historical submission{subCount!==1?'s':''} preserved</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {tab==='submissions' && (
        <>
          <div style={{ ...S.card, padding:16, marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:0.5, marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Filter Submissions</span>
              {hasFilters && <button style={{ ...btn('outline'), padding:'3px 10px', fontSize:11, color:'#dc2626' }} onClick={()=>{setFRef('');setFStatus('');setFUser('');setFFrom('');setFTo('');}}>Clear</button>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:10 }}>
              <div><label style={lbl()}>Form Name or Ref</label><input style={inp()} placeholder="e.g. F-07 or Bank Reconciliation" value={fRef} onChange={e=>setFRef(e.target.value)} /></div>
              <div><label style={lbl()}>Status</label><select style={inp()} value={fStatus} onChange={e=>setFStatus(e.target.value)}><option value="">All Statuses</option>{Object.entries(WF_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label style={lbl()}>Submitted By</label><select style={inp()} value={fUser} onChange={e=>setFUser(e.target.value)}><option value="">All Staff</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
              <div><label style={lbl()}>From Date</label><input style={inp()} type="date" value={fFrom} onChange={e=>setFFrom(e.target.value)} /></div>
              <div><label style={lbl()}>To Date</label><input style={inp()} type="date" value={fTo} onChange={e=>setFTo(e.target.value)} /></div>
            </div>
            {hasFilters && <div style={{ marginTop:10, fontSize:12, color:'#6b7280' }}>Showing <strong>{filteredSubs.length}</strong> of {baseSubs.length} submissions</div>}
          </div>
          <div style={{ ...S.card, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr><Th>Ref</Th><Th>Form Name</Th><Th>Submitted By</Th><Th>Date</Th><Th>Status</Th><Th></Th></tr></thead>
              <tbody>
                {filteredSubs.length===0 ? <tr><td colSpan={6} style={{ textAlign:'center', color:'#6b7280', padding:34 }}>{hasFilters?'No submissions match your filters.':'No submissions yet.'}</td></tr>
                : filteredSubs.map(s => {
                  const f=forms.find(f=>f.ref===s.formRef); const sm=WF_STATUS[s.wfStatus||'no_workflow'];
                  return (<tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <Td style={{ fontWeight:700, color:GOLD }}>{s.formRef}</Td>
                    <Td style={{ fontWeight:500 }}>
                      {f&&f.title}
                      {s.isExternal && <span style={{ ...bdg('#f0fdf4','#059669'), marginLeft:7, fontSize:10 }}>External</span>}
                    </Td>
                    <Td>
                      <div>{s.submittedByName}</div>
                      {s.isExternal && s.externalEmail && <div style={{ fontSize:11, color:'#6b7280' }}>{s.externalEmail}</div>}
                    </Td>
                    <Td style={{ color:'#6b7280' }}>{new Date(s.submittedAt).toLocaleString()}</Td>
                    <Td><span style={bdg(sm.bg,sm.color)}>{sm.label}</span></Td>
                    <Td><button style={{ ...btn('outline'), padding:'4px 10px', fontSize:11 }} onClick={()=>setViewSub(s)}><Icon name="eye" size={11} /> View</button></Td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sel && <FormFillModal form={sel} user={user} wfConfig={wfConfigs[sel.ref]||null} users={users} onSubmit={handleSubmit} onClose={()=>setSel(null)} doaConfig={doaConfig} />}
      {viewSub && <ViewSubModal sub={viewSub} users={users} onClose={()=>setViewSub(null)} />}
      {shareTarget && <ShareModal form={shareTarget} onClose={()=>setShareTarget(null)} />}

      {archiveTarget && (
        <div style={S.overlay}><div style={{ ...S.modal, maxWidth:440 }}>
          <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb' }}><div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Archive Form</div></div>
          <div style={{ padding:'20px 22px' }}>
            <div style={{ padding:'12px 14px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:8, marginBottom:14, fontSize:13, color:'#92400e' }}><strong>Archiving:</strong> {archiveTarget.ref} — {archiveTarget.title}</div>
            <p style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginBottom:14 }}>This form will be hidden from staff immediately. All past submissions are <strong>permanently preserved</strong> in the audit trail.</p>
            <div><label style={lbl()}>Archive Note (optional)</label><input style={inp()} value={archiveNote} onChange={e=>setArchiveNote(e.target.value)} placeholder="e.g. Replaced by new process..." /></div>
          </div>
          <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
            <button style={btn('outline')} onClick={()=>setArchiveTarget(null)} disabled={archiveSaving}>Cancel</button>
            <button style={{ ...btn('danger'), background:'#dc2626', color:'#fff', opacity:archiveSaving?0.6:1 }} onClick={doArchive} disabled={archiveSaving}>{archiveSaving?'Archiving...':'Archive Form'}</button>
          </div>
        </div></div>
      )}
    </div>
  );
}

// ── My Inbox ───────────────────────────────────────────────────────────────────
function MyInbox({ user, submissions, setSubmissions, users, doaConfig }) {
  const forms = useForms();
  const [reviewSub, setReviewSub] = useState(null);
  const myPending   = submissions.filter(s => getApprover(s) === user.id);
  const myCompleted = submissions.filter(s => (s.approvals||[]).some(a => a.userId === user.id));

  async function handleAction(subId, action, levelOrType, note, doaStepIdx) {
    const sub  = submissions.find(s => s.id === subId);
    if (!sub) return;
    const form = forms.find(f => f.ref === sub.formRef);
    const isDoA = levelOrType === 'doa';

    let newStatus, newWf, newApproval;

    if (isDoA) {
      // DoA multi-step
      const step = sub.wf.steps[doaStepIdx];
      newApproval = { stepIndex:doaStepIdx, role:step?.role, label:step?.label, userId:user.id, userName:user.name, action, note, at:new Date().toISOString() };
      if (action === 'rejected') {
        newStatus = 'rejected';
        newWf     = sub.wf;
      } else {
        const nextIdx = doaStepIdx + 1;
        newStatus = nextIdx >= sub.wf.steps.length ? 'approved' : 'pending_doa';
        newWf     = { ...sub.wf, currentStep: nextIdx };
      }
    } else {
      // Standard L1/L2
      const level = levelOrType;
      newApproval = { level, userId:user.id, userName:user.name, action, note, at:new Date().toISOString() };
      if (action === 'rejected') newStatus = 'rejected';
      else newStatus = (level===1 && sub.wf && sub.wf.l2) ? 'pending_l2' : 'approved';
      newWf = sub.wf;
    }

    const approvals = [...(sub.approvals||[]), newApproval];
    await dbUpdateSubmissionFull({ id:subId, wfStatus:newStatus, approvals, wf:newWf });
    setSubmissions(prev => prev.map(s => s.id===subId ? {...s, wfStatus:newStatus, approvals, wf:newWf} : s));

    // ── Email notifications ────────────────────────────────────────────────
    if (isDoA && action === 'approved' && newStatus === 'pending_doa') {
      // Notify next DoA step approver
      const nextStep = newWf.steps[newWf.currentStep];
      if (nextStep) await sendNotify({ to:uEmail(users,nextStep.userId), toName:uName(users,nextStep.userId), fromName:user.name, formRef:sub.formRef, formTitle:form?.title, level:1 });
    }
    if (!isDoA && action==='approved' && levelOrType===1 && sub.wf?.l2) {
      await sendNotify({ to:uEmail(users,sub.wf.l2), toName:uName(users,sub.wf.l2), fromName:user.name, formRef:sub.formRef, formTitle:form?.title, level:2 });
    }
    if (action === 'rejected') {
      await sendNotify({ to:uEmail(users,sub.submittedBy), toName:sub.submittedByName, fromName:user.name, formRef:sub.formRef, formTitle:form?.title, level:'rejected', note });
    }
    if (action === 'approved' && newStatus === 'approved') {
      await sendNotify({ to:uEmail(users,sub.submittedBy), toName:sub.submittedByName, fromName:user.name, formRef:sub.formRef, formTitle:form?.title, level:'approved' });
    }
    setReviewSub(null);
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom:22 }}><div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:NAV }}>My Inbox</div><div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Forms waiting for your review or approval</div></div>
      {myPending.length===0 ? (
        <div style={{ ...S.card, padding:40, textAlign:'center' }}>
          <div style={{ width:52, height:52, background:'#d1fae5', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}><Icon name="check" size={26} color="#059669" /></div>
          <div style={{ fontWeight:600, color:'#059669', fontSize:14 }}>All clear!</div>
          <div style={{ fontSize:13, color:'#6b7280', marginTop:4 }}>No forms are currently awaiting your action.</div>
        </div>
      ) : (<>
        <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>{myPending.length} awaiting your action</div>
        {myPending.map(s => {
          const form=forms.find(f=>f.ref===s.formRef);
          const isL1=s.wfStatus==='pending_l1';
          const isDoA=s.wf?.type==='doa';
          const doaStep=isDoA?s.wf?.steps?.[s.wf?.currentStep??0]:null;
          const stepLabel=isDoA&&doaStep?doaStep.label:(isL1?'Level 1 Review':'Level 2 Approval');
          const stepClrs=isDoA?['#f5f3ff','#6d28d9']:isL1?['#fef3c7','#92400e']:['#dbeafe','#1e40af'];
          return (<div key={s.id} onClick={()=>setReviewSub(s)}
            style={{ background:'#fff', borderRadius:10, padding:18, borderLeft:`4px solid ${isDoA?'#7c3aed':GOLD}`, boxShadow:'0 1px 4px rgba(0,0,0,0.09)', marginBottom:12, cursor:'pointer' }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'} onMouseLeave={e=>e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.09)'}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontWeight:700, color:GOLD, fontSize:12 }}>{s.formRef}</span>
                <span style={pll(FREQ_CLR[form&&form.freq]||'#6b7280')}>{form&&form.freq}</span>
                <span style={bdg(stepClrs[0], stepClrs[1])}>{stepLabel}</span>
              </div>
              <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(s.submittedAt).toLocaleDateString()}</span>
            </div>
            <div style={{ fontWeight:600, fontSize:14, color:NAV, marginBottom:3 }}>{form&&form.title}</div>
            <div style={{ fontSize:12, color:'#6b7280' }}>Submitted by <strong>{s.submittedByName}</strong></div>
            <div style={{ marginTop:10, display:'flex', justifyContent:'flex-end' }}>
              <button style={{ ...btn('primary'), padding:'6px 14px', fontSize:12 }} onClick={e=>{e.stopPropagation();setReviewSub(s);}}><Icon name="eye" size={13} /> Review and Act</button>
            </div>
          </div>);
        })}
      </>)}
      {myCompleted.length>0 && (<>
        <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, margin:'24px 0 12px' }}>Previously Reviewed</div>
        <div style={{ ...S.card, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr><Th>Ref</Th><Th>Form</Th><Th>Submitted By</Th><Th>Your Action</Th><Th>Date</Th></tr></thead>
            <tbody>{myCompleted.map(s => {
              const form=forms.find(f=>f.ref===s.formRef); const a=(s.approvals||[]).find(a=>a.userId===user.id);
              return (<tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <Td style={{ fontWeight:700, color:GOLD }}>{s.formRef}</Td><Td style={{ fontWeight:500 }}>{form&&form.title}</Td><Td>{s.submittedByName}</Td>
                <Td>{a&&<span style={bdg(a.action==='approved'?'#d1fae5':'#fee2e2',a.action==='approved'?'#059669':'#dc2626')}>L{a.level} {a.action==='approved'?'Approved':'Rejected'}</span>}</Td>
                <Td style={{ color:'#6b7280', fontSize:11 }}>{a&&new Date(a.at).toLocaleDateString()}</Td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      </>)}
      {reviewSub && <ReviewModal sub={reviewSub} currentUser={user} users={users} onAction={handleAction} onClose={()=>setReviewSub(null)} />}
    </div>
  );
}

// ── Workflow Setup ─────────────────────────────────────────────────────────────
function WorkflowSetup({ users, wfConfigs, setWfConfigs, doaConfig, setDoaConfig }) {
  const forms = useForms();
  const [saved, setSaved]    = useState(null);
  const [doaSaved, setDoaSaved] = useState(false);
  const [localDoa, setLocalDoa] = useState({ ...doaConfig });

  async function update(ref, field, val) {
    const updated = { ...wfConfigs, [ref]:{ ...(wfConfigs[ref]||{}), [field]:val||null } };
    if (!updated[ref].l1 && !updated[ref].l2) delete updated[ref];
    setWfConfigs(updated);
    await dbUpsertWorkflow({ formRef:ref, l1:updated[ref]?.l1||null, l2:updated[ref]?.l2||null });
    setSaved(ref); setTimeout(()=>setSaved(null),2000);
  }

  async function saveDoaConfig() {
    const { error } = await dbSaveDoaConfig(localDoa);
    if (!error) {
      setDoaConfig(localDoa);
      setDoaSaved(true);
      setTimeout(()=>setDoaSaved(false), 2500);
    }
  }

  const freqGroups = {};
  forms.forEach(f => { if (!freqGroups[f.freq]) freqGroups[f.freq]=[]; freqGroups[f.freq].push(f); });

  return (
    <div style={{ padding:26 }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:NAV }}>Workflow Setup</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:3 }}>Configure approval routing for each form. For most forms, L1 is the submitter's line manager (set in User Management). L2 is the final backend approver.</div>
      </div>

      {/* ── DoA Configuration for F-08 ── */}
      <div style={{ background:'#fff', borderRadius:10, border:'2px solid #ddd6fe', padding:22, marginBottom:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:'#6d28d9', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ background:'#ede9fe', padding:'3px 9px', borderRadius:5, fontSize:11, fontWeight:700 }}>F-08</span>
              Delegation of Authority — Role Configuration
            </div>
            <div style={{ fontSize:12.5, color:'#6b7280', marginTop:4 }}>
              These roles determine the approval chain for the Payment Approval form based on amount. Finance and Compliance cannot initiate F-08.
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
            {doaSaved && <span style={{ fontSize:12, color:'#059669', fontWeight:500 }}>Saved ✓</span>}
            <button style={{ ...btn('outline'), padding:'8px 16px' }} onClick={saveDoaConfig}>Save DoA Roles</button>
          </div>
        </div>

        <div style={{ padding:'11px 14px', background:'#fffbeb', borderRadius:8, border:'1.5px solid #fde68a', marginBottom:16, fontSize:12.5, color:'#92400e' }}>
          <strong>Routing rules:</strong> ≤₦50k → Finance only &nbsp;|&nbsp; ₦50k–₦5M → Line Manager → Finance &nbsp;|&nbsp; ₦5M–₦10M → Line Manager → Compliance → MD → Finance &nbsp;|&nbsp; &gt;₦10M → Line Manager → Compliance → MD → Chairman → Finance. If submitter IS the line manager, that step is skipped.
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {[
            { key:'financeUser',    label:'Finance Approver',    note:'Records in books and raises payment. Cannot initiate.', color:'#059669' },
            { key:'complianceUser', label:'Compliance Reviewer',  note:'Reviews ₦5M+ payments. Cannot initiate F-08.',         color:'#7c3aed' },
            { key:'mdUser',         label:'Managing Director',    note:'Approves ₦5M–₦10M+ payments.',                         color:'#2563eb' },
            { key:'chairmanUser',   label:'Chairman of the Board', note:'Final approval for payments above ₦10M.',              color:'#dc2626' },
          ].map(role => (
            <div key={role.key} style={{ padding:'13px 16px', background:'#fafafa', borderRadius:9, border:`1.5px solid ${role.color}22` }}>
              <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:role.color }} />
                <label style={{ fontWeight:600, fontSize:13, color:NAV }}>{role.label}</label>
              </div>
              <div style={{ fontSize:11.5, color:'#6b7280', marginBottom:9 }}>{role.note}</div>
              <select style={inp()} value={localDoa[role.key] || ''} onChange={e => setLocalDoa(prev => ({ ...prev, [role.key]: e.target.value || null }))}>
                <option value="">— Not assigned —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}
              </select>
              {localDoa[role.key] && (
                <div style={{ marginTop:6, fontSize:11, color:role.color, fontWeight:500 }}>
                  ✓ {uName(users, localDoa[role.key])}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'12px 16px', background:'#f0f4ff', borderRadius:9, border:'1.5px solid #c7d2fe', marginBottom:22, fontSize:12.5, color:'#3730a3' }}>
        <strong>Standard forms:</strong> L1 uses the submitter's <strong>Line Manager</strong> (set in User Management). The L1 column below is a fallback if no line manager is assigned. L2 is the final backend approver.
      </div>

      {Object.entries(freqGroups).map(([freq, grpForms]) => (
        <div key={freq} style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
            <span style={pll(FREQ_CLR[freq]||'#6b7280')}>{freq}</span>
            <span style={{ fontSize:12, color:'#6b7280' }}>{grpForms.length} form{grpForms.length>1?'s':''}</span>
          </div>
          <div style={{ background:'#fff', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
              <thead><tr><Th>Form</Th><Th>L1 Fallback Reviewer</Th><Th>L2 / Final Approver</Th><Th>Status</Th></tr></thead>
              <tbody>{grpForms.map(form => {
                const cfg = wfConfigs[form.ref]||{};
                if (form.ref === 'F-08') return (
                  <tr key={form.ref} style={{ borderBottom:'1px solid #f3f4f6', background:'#f5f3ff' }}>
                    <Td><div style={{ fontWeight:600, fontSize:12.5, color:'#6d28d9' }}><span style={{ color:GOLD, fontWeight:700, marginRight:6 }}>F-08</span>{form.title}</div><div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>Uses DoA routing above — configured separately</div></Td>
                    <Td colSpan={3}><span style={bdg('#ede9fe','#6d28d9')}>DoA routing active — see configuration above</span></Td>
                  </tr>
                );
                return (<tr key={form.ref} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <Td><div style={{ fontWeight:600, fontSize:12.5, color:NAV }}><span style={{ color:GOLD, fontWeight:700, marginRight:6 }}>{form.ref}</span>{form.title}</div><div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>{form.section}</div></Td>
                  <Td><select style={inp()} value={cfg.l1||''} onChange={e=>update(form.ref,'l1',e.target.value)}><option value="">— Line manager (default) —</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}</select></Td>
                  <Td><select style={{ ...(inp()), opacity:1 }} value={cfg.l2||''} onChange={e=>update(form.ref,'l2',e.target.value)}><option value="">— No L2 Approver —</option>{users.filter(u=>u.id!==cfg.l1).map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}</select></Td>
                  <Td style={{ textAlign:'center' }}>{saved===form.ref?<span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>Saved</span>:cfg.l1||cfg.l2?<span style={bdg('#d1fae5','#059669')}>Active</span>:<span style={bdg('#f3f4f6','#9ca3af')}>Uses Line Mgr</span>}</Td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
// ── Workflow Dashboard ─────────────────────────────────────────────────────────
function WorkflowDash({ submissions, setSubmissions, users }) {
  const forms = useForms();
  const [filter,     setFilter]     = useState('all');
  const [reviewSub,  setReviewSub]  = useState(null);
  const [rerouteSub, setRerouteSub] = useState(null);
  const [rrL1,  setRrL1]   = useState('');
  const [rrL2,  setRrL2]   = useState('');
  const [rrNote,setRrNote]  = useState('');
  const [rrSaving, setRrSaving] = useState(false);

  const inFlight   = submissions.filter(s => s.wfStatus && s.wfStatus !== 'no_workflow');
  const byStatus   = {
    pending_l1: inFlight.filter(s=>s.wfStatus==='pending_l1'),
    pending_l2: inFlight.filter(s=>s.wfStatus==='pending_l2'),
    approved:   inFlight.filter(s=>s.wfStatus==='approved'),
    rejected:   inFlight.filter(s=>s.wfStatus==='rejected'),
  };
  const displayed  = filter==='all' ? inFlight : inFlight.filter(s=>s.wfStatus===filter);
  const now        = new Date();
  const admin      = users.find(u=>u.role==='admin') || users[0];

  function isStale(s) {
    if (s.wfStatus==='approved' || s.wfStatus==='rejected') return false;
    const last = (s.approvals||[]).length>0
      ? new Date(s.approvals[s.approvals.length-1].at)
      : new Date(s.submittedAt);
    return (now-last)/(1000*60*60*24) >= 3;
  }
  const staleCount = inFlight.filter(s=>isStale(s)).length;

  async function handleAction(subId, action, level, note) {
    const sub = submissions.find(s=>s.id===subId); if (!sub) return;
    const newApproval = { level, userId:admin.id, userName:admin.name, action, note, at:new Date().toISOString() };
    const approvals   = [...(sub.approvals||[]), newApproval];
    let ns = sub.wfStatus;
    if (action==='rejected') ns='rejected';
    else if (action==='approved') ns=(level===1&&sub.wf&&sub.wf.l2)?'pending_l2':'approved';
    await dbUpdateSubmission({ id:subId, wfStatus:ns, approvals });
    setSubmissions(prev=>prev.map(s=>s.id===subId?{...s,wfStatus:ns,approvals}:s));
    // Notifications
    const form = forms.find(f=>f.ref===sub.formRef);
    if (action==='approved' && level===1 && sub.wf?.l2)
      await sendNotify({ to:uEmail(users,sub.wf.l2), toName:uName(users,sub.wf.l2), fromName:admin.name, formRef:sub.formRef, formTitle:form?.title, level:2 });
    if (action==='rejected')
      await sendNotify({ to:uEmail(users,sub.submittedBy), toName:sub.submittedByName, fromName:admin.name, formRef:sub.formRef, formTitle:form?.title, level:'rejected', note });
    if (action==='approved' && ns==='approved')
      await sendNotify({ to:uEmail(users,sub.submittedBy), toName:sub.submittedByName, fromName:admin.name, formRef:sub.formRef, formTitle:form?.title, level:'approved' });
    setReviewSub(null);
  }

  async function doReroute() {
    if (!rerouteSub || !rrL1) return;
    setRrSaving(true);
    const result = await dbRerouteSubmission({
      id:             rerouteSub.id,
      newL1:          rrL1,
      newL2:          rrL2 || null,
      note:           rrNote || `Re-routed by ${admin.name}`,
      reroutedBy:     admin.id,
      reroutedByName: admin.name,
    });
    if (!result.error) {
      setSubmissions(prev => prev.map(s => s.id===rerouteSub.id
        ? { ...s, wf:result.newWf, wfStatus:result.newStatus, approvals:result.approvals }
        : s
      ));
      // Notify new L1
      const form = forms.find(f=>f.ref===rerouteSub.formRef);
      await sendNotify({ to:uEmail(users,rrL1), toName:uName(users,rrL1), fromName:admin.name, formRef:rerouteSub.formRef, formTitle:form?.title, level:1 });
    }
    setRerouteSub(null); setRrL1(''); setRrL2(''); setRrNote(''); setRrSaving(false);
  }

  return (
    <div style={S.page}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:NAV }}>Workflow Dashboard</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:3 }}>Live view of all forms in the approval pipeline</div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:22 }}>
        {[
          {label:'Total In Pipeline',    v:inFlight.length,             c:NAV,       k:'all'},
          {label:'Awaiting L1 Review',   v:byStatus.pending_l1.length,  c:'#d97706', k:'pending_l1'},
          {label:'Awaiting L2 Approval', v:byStatus.pending_l2.length,  c:'#2563eb', k:'pending_l2'},
          {label:'Fully Approved',       v:byStatus.approved.length,    c:'#059669', k:'approved'},
          {label:'Rejected',             v:byStatus.rejected.length,    c:'#dc2626', k:'rejected'},
        ].map(s => (
          <div key={s.k} onClick={()=>setFilter(s.k)}
            style={{ background:'#fff', borderRadius:10, padding:18, borderLeft:`4px solid ${filter===s.k?s.c:GOLD}`, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', cursor:'pointer', opacity:filter!=='all'&&filter!==s.k?0.6:1 }}>
            <div style={{ fontSize:26, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
            <div style={{ fontSize:11.5, color:'#6b7280', marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {staleCount > 0 && (
        <div style={{ padding:'10px 14px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:8, marginBottom:16, fontSize:12.5, color:'#92400e' }}>
          <strong>Warning: {staleCount} form{staleCount>1?'s':''} stale</strong> — no action taken in 3+ days. Use Re-route to reassign to an available approver.
        </div>
      )}

      {/* Pipeline table */}
      <div style={{ ...S.card, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr><Th>Ref</Th><Th>Form</Th><Th>Submitted By</Th><Th>Date</Th><Th>Status</Th><Th>Currently With</Th><Th>Days</Th><Th>Actions</Th></tr>
          </thead>
          <tbody>
            {displayed.length === 0
              ? <tr><td colSpan={8} style={{ textAlign:'center', color:'#6b7280', padding:34 }}>No forms in this category.</td></tr>
              : displayed.sort((a,b)=>new Date(a.submittedAt)-new Date(b.submittedAt)).map(s => {
                const form     = forms.find(f=>f.ref===s.formRef);
                const sm       = WF_STATUS[s.wfStatus];
                const appId    = getApprover(s);
                const appName  = appId ? uName(users,appId) : '—';
                const lastDate = (s.approvals||[]).length>0 ? new Date(s.approvals[s.approvals.length-1].at) : new Date(s.submittedAt);
                const days     = Math.floor((now-lastDate)/(1000*60*60*24));
                const stale    = isStale(s);
                const canReroute = s.wfStatus==='pending_l1' || s.wfStatus==='pending_l2';
                return (
                  <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <Td style={{ fontWeight:700, color:GOLD }}>{s.formRef}</Td>
                    <Td style={{ fontWeight:500, maxWidth:160 }}><div style={{ fontSize:12.5 }}>{form&&form.title}</div></Td>
                    <Td style={{ fontSize:12 }}>{s.submittedByName}</Td>
                    <Td style={{ color:'#6b7280', fontSize:11 }}>{new Date(s.submittedAt).toLocaleDateString()}</Td>
                    <Td><span style={bdg(sm.bg,sm.color)}>{sm.label}</span></Td>
                    <Td style={{ fontSize:12.5, fontWeight:500, color:appId?NAV:'#9ca3af' }}>{appName}</Td>
                    <Td>
                      {canReroute
                        ? <span style={{ fontSize:12, fontWeight:600, color:stale?'#dc2626':days>=1?'#d97706':'#059669' }}>{days===0?'Today':`${days}d`}{stale?' !':''}</span>
                        : <span style={{ fontSize:11, color:'#9ca3af' }}>—</span>}
                    </Td>
                    <Td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button style={{ ...btn('outline'), padding:'4px 9px', fontSize:11 }} onClick={()=>setReviewSub(s)}>
                          <Icon name="eye" size={11} /> View
                        </button>
                        {canReroute && (
                          <button
                            style={{ ...btn('outline'), padding:'4px 9px', fontSize:11, color:'#7c3aed', borderColor:'#ddd6fe' }}
                            onClick={() => { setRerouteSub(s); setRrL1(s.wf?.l1||''); setRrL2(s.wf?.l2||''); setRrNote(''); }}>
                            Re-route
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })
            }
          </tbody>
        </table>
      </div>

      {reviewSub && <ReviewModal sub={reviewSub} currentUser={admin} users={users} onAction={handleAction} onClose={()=>setReviewSub(null)} />}

      {/* Re-route modal */}
      {rerouteSub && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:480 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Re-route Form</div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>
                {rerouteSub.formRef} — {forms.find(f=>f.ref===rerouteSub.formRef)?.title}
              </div>
            </div>
            <div style={{ padding:'20px 22px', display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ padding:'10px 13px', background:'#f5f3ff', border:'1.5px solid #ddd6fe', borderRadius:8, fontSize:12.5, color:'#5b21b6' }}>
                The form will be re-assigned and the new Level 1 approver will receive an email notification.
              </div>
              <div>
                <label style={lbl()}>New Level 1 Reviewer *</label>
                <select style={inp()} value={rrL1} onChange={e=>{ setRrL1(e.target.value); if(rrL2===e.target.value) setRrL2(''); }}>
                  <option value="">— Select approver —</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl()}>New Level 2 Approver (optional)</label>
                <select style={{ ...inp(), opacity:rrL1?1:0.5 }} value={rrL2} disabled={!rrL1}
                  onChange={e=>setRrL2(e.target.value)}>
                  <option value="">— No Level 2 —</option>
                  {users.filter(u=>u.id!==rrL1).map(u=><option key={u.id} value={u.id}>{u.name} ({u.dept})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl()}>Reason for Re-routing</label>
                <textarea style={{ ...inp(), minHeight:70, resize:'vertical' }} value={rrNote}
                  onChange={e=>setRrNote(e.target.value)}
                  placeholder="e.g. Original approver is on leave, reassigning to deputy..." />
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end', alignItems:'center' }}>
              {rrSaving && <span style={{ fontSize:12, color:'#6b7280' }}>Saving...</span>}
              <button style={btn('outline')} onClick={()=>setRerouteSub(null)} disabled={rrSaving}>Cancel</button>
              <button
                style={{ ...btn('primary'), background:'#7c3aed', opacity:(!rrL1||rrSaving)?0.5:1 }}
                onClick={doReroute} disabled={!rrL1||rrSaving}>
                {rrSaving ? 'Re-routing...' : 'Confirm Re-route'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────────
function Reports({ policies, signoffs, submissions, users }) {
  const forms = useForms();
  const [rt, setRt] = useState('policy');

  const activePolicies = policies.filter(p => !p.status || p.status === 'active');
  const polRep = activePolicies.map(p => ({
    ...p,
    signers:  signoffs.filter(s=>s.policy_id===p.id).map(s=>({...s,u:users.find(u=>u.id===s.user_id)})),
    unsigned: users.filter(u=>!signoffs.find(s=>s.policy_id===p.id&&s.user_id===u.id)),
    pct:      Math.round(signoffs.filter(s=>s.policy_id===p.id).length/Math.max(users.length,1)*100),
  }));
  const archivedWithSigns = policies
    .filter(p => p.status === 'archived')
    .map(p => ({ ...p, signers: signoffs.filter(s=>s.policy_id===p.id).map(s=>({...s,u:users.find(u=>u.id===s.user_id)})) }))
    .filter(p => p.signers.length > 0);
  const userRep = users.map(u => ({
    ...u,
    signed:   activePolicies.filter(p=>signoffs.find(s=>s.policy_id===p.id&&s.user_id===u.id)),
    unsigned: activePolicies.filter(p=>!signoffs.find(s=>s.policy_id===p.id&&s.user_id===u.id)),
    forms:    submissions.filter(s=>s.submittedBy===u.id),
  }));
  const formRep = forms.map(f => ({
    ...f,
    subs: submissions.filter(s=>s.formRef===f.ref),
    last: submissions.filter(s=>s.formRef===f.ref).sort((a,b)=>new Date(b.submittedAt)-new Date(a.submittedAt))[0],
  }));
  const tabStyle = active => ({ display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px', cursor:'pointer', fontSize:12.5, borderBottom:`2.5px solid ${active?GOLD:'transparent'}`, color:active?NAV:'#6b7280', fontWeight:500 });
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  function openPrint(title, bodyHtml) {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<title>${title} — Transworld Portal</title>
<style>
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;margin:0;padding:0;}
  .page{padding:18mm 20mm;max-width:210mm;margin:0 auto;}
  .hdr{border-bottom:3px solid #0d1f3c;padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;}
  .ftr{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;font-size:8pt;color:#9ca3af;display:flex;justify-content:space-between;}
  @page{size:A4;margin:0;}
</style></head><body><div class="page">
<div class="hdr">
  <div>
    <div style="font-size:14pt;font-weight:700;color:#0d1f3c;">Transworld Investment and Securities Limited</div>
    <div style="font-size:8pt;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Compliance and Control Portal</div>
  </div>
  <div style="text-align:right;font-size:9pt;color:#6b7280;">Printed: ${now}</div>
</div>
<div style="font-size:18pt;font-weight:700;color:#0d1f3c;margin-bottom:4px;">${title}</div>
<div style="font-size:9pt;color:#6b7280;margin-bottom:20px;">Generated ${now} &nbsp;·&nbsp; ${users.length} staff &nbsp;·&nbsp; ${activePolicies.length} active policies</div>
${bodyHtml}
<div class="ftr"><div>Transworld Investment and Securities Limited</div><div>Confidential — Internal Use Only</div></div>
</div></body></html>`);
    w.document.close();
    w.onload = () => w.print();
  }

  function printPolicy() {
    const rows = polRep.map(p => `
      <div style="margin-bottom:18px;padding:14px;border:1px solid #e5e7eb;border-radius:8px;page-break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:12pt;color:#0d1f3c;">${p.title}</div>
            <div style="font-size:8pt;color:#6b7280;">${p.category} · ${p.version}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20pt;font-weight:700;color:${p.pct===100?'#059669':p.pct>60?'#d97706':'#dc2626'};">${p.pct}%</div>
            <div style="font-size:8pt;color:#6b7280;">${p.signers.length}/${users.length} signed</div>
          </div>
        </div>
        <div style="background:#f3f4f6;border-radius:3px;height:7px;margin-bottom:10px;">
          <div style="width:${p.pct}%;height:100%;border-radius:3px;background:${p.pct===100?'#059669':p.pct>60?'#d97706':'#dc2626'};"></div>
        </div>
        <div style="margin-bottom:5px;"><strong style="font-size:8pt;">Signed: </strong>
          ${p.signers.length===0?'<em style="color:#9ca3af;font-size:8pt;">None yet</em>':p.signers.map(s=>`<span style="display:inline-block;margin:1px 3px;padding:1px 7px;background:#d1fae5;color:#059669;border-radius:3px;font-size:8pt;">✓ ${s.u?s.u.name:s.user_name}</span>`).join('')}
        </div>
        ${p.unsigned.length>0?`<div><strong style="font-size:8pt;">Pending: </strong>${p.unsigned.map(u=>`<span style="display:inline-block;margin:1px 3px;padding:1px 7px;background:#fee2e2;color:#dc2626;border-radius:3px;font-size:8pt;">✗ ${u.name}</span>`).join('')}</div>`:''}
      </div>`).join('');
    const arch = archivedWithSigns.length>0 ? `
      <div style="margin-top:24px;border-top:1px solid #e5e7eb;padding-top:16px;">
        <div style="font-size:8pt;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Archived Policy Records</div>
        ${archivedWithSigns.map(p=>`<div style="margin-bottom:8px;padding:10px;border:1px solid #e5e7eb;border-radius:6px;">
          <div style="font-weight:600;font-size:10pt;color:#6b7280;">${p.title} <span style="font-size:8pt;padding:1px 6px;background:#f3f4f6;border-radius:3px;">Archived · ${p.version}</span></div>
          <div style="margin-top:5px;">${p.signers.map(s=>`<span style="display:inline-block;margin:1px 3px;padding:1px 6px;background:#f3f4f6;color:#6b7280;border-radius:3px;font-size:8pt;">✓ ${s.u?s.u.name:s.user_name} · ${new Date(s.signed_at).toLocaleDateString()}</span>`).join('')}</div>
        </div>`).join('')}
      </div>` : '';
    openPrint('Policy Compliance Report', rows+arch);
  }

  function printUsers() {
    const rows = userRep.map(u => {
      const sc = Math.round(u.signed.length/Math.max(activePolicies.length,1)*100);
      return `<tr>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;">${u.name}<br/><span style="font-size:7.5pt;color:#9ca3af;">${u.email}</span></td>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;">${u.dept}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;text-align:center;color:#059669;font-weight:700;">${u.signed.length}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;text-align:center;color:${u.unsigned.length>0?'#dc2626':'#6b7280'};font-weight:700;">${u.unsigned.length}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;text-align:center;">${u.forms.length}</td>
        <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:700;color:${sc===100?'#059669':sc>60?'#d97706':'#dc2626'};">${sc}%</td>
      </tr>`;
    }).join('');
    openPrint('Staff Activity Report', `
      <table style="width:100%;border-collapse:collapse;font-size:10pt;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Staff Member</th>
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Department</th>
          <th style="padding:8px 9px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Signed</th>
          <th style="padding:8px 9px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Pending</th>
          <th style="padding:8px 9px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Forms</th>
          <th style="padding:8px 9px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Score</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  function printForms() {
    const rows = formRep.map(f => `<tr>
      <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;font-weight:700;color:#c9a84c;">${f.ref}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;">${f.title}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;">${f.freq}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;text-align:center;font-weight:700;color:${f.subs.length>0?'#2563eb':'#9ca3af'};">${f.subs.length}</td>
      <td style="padding:7px 9px;border-bottom:1px solid #f3f4f6;font-size:8.5pt;color:#6b7280;">${f.last?`${new Date(f.last.submittedAt).toLocaleDateString()} · ${f.last.submittedByName}`:'Not yet submitted'}</td>
    </tr>`).join('');
    openPrint('Form Submission Summary', `
      <table style="width:100%;border-collapse:collapse;font-size:10pt;">
        <thead><tr style="background:#f9fafb;">
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Ref</th>
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Form Title</th>
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Frequency</th>
          <th style="padding:8px 9px;text-align:center;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Submissions</th>
          <th style="padding:8px 9px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:7.5pt;text-transform:uppercase;">Last Submitted</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`);
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:NAV }}>Reports and Analytics</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Compliance and control activity reporting</div>
        </div>
        <button style={{ ...btn('green'), padding:'8px 16px', fontSize:12.5 }}
          onClick={() => { if(rt==='policy') printPolicy(); else if(rt==='users') printUsers(); else printForms(); }}>
          <Icon name="print" size={14} /> Print / Save as PDF
        </button>
      </div>

      <div style={{ display:'flex', gap:0, borderBottom:'1.5px solid #e5e7eb', marginBottom:18 }}>
        <div style={tabStyle(rt==='policy')} onClick={()=>setRt('policy')}><Icon name="shield" size={13} /> Policy Compliance</div>
        <div style={tabStyle(rt==='users')}  onClick={()=>setRt('users')} ><Icon name="users"  size={13} /> User Activity</div>
        <div style={tabStyle(rt==='forms')}  onClick={()=>setRt('forms')} ><Icon name="chart"  size={13} /> Form Summary</div>
      </div>

      {rt==='policy' && (
        <div>
          <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
            {polRep.map(p=>(
              <div key={p.id} style={{ ...S.card, padding:18 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div><div style={{ fontWeight:600, fontSize:13.5, color:NAV }}>{p.title}</div><div style={{ fontSize:11, color:'#6b7280' }}>{p.category} · {p.version}</div></div>
                  <div style={{ textAlign:'right' }}><div style={{ fontSize:24, fontWeight:700, color:p.pct===100?'#059669':p.pct>60?'#d97706':'#dc2626', fontFamily:"'Playfair Display',serif" }}>{p.pct}%</div><div style={{ fontSize:10, color:'#6b7280' }}>{p.signers.length}/{users.length} signed</div></div>
                </div>
                <div style={{ background:'#f3f4f6', borderRadius:4, height:6, marginBottom:10 }}><div style={{ width:`${p.pct}%`, height:'100%', borderRadius:4, background:p.pct===100?'#059669':p.pct>60?'#d97706':'#dc2626' }} /></div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {p.signers.map(s=><span key={s.user_id} style={{ display:'inline-flex', padding:'2px 7px', borderRadius:5, fontSize:11, background:'#d1fae5', color:'#059669' }}>✓ {s.u&&s.u.name}</span>)}
                  {p.unsigned.map(u=><span key={u.id}     style={{ display:'inline-flex', padding:'2px 7px', borderRadius:5, fontSize:11, background:'#fee2e2', color:'#dc2626' }}>✗ {u.name}</span>)}
                </div>
              </div>
            ))}
          </div>
          {archivedWithSigns.length > 0 && (
            <div style={{ marginTop:28 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:1, marginBottom:12 }}>Archived Policy Acknowledgement Records</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {archivedWithSigns.map(p => (
                  <div key={p.id} style={{ ...S.card, padding:16, border:'1.5px solid #e5e7eb', opacity:0.85 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ fontWeight:600, fontSize:13, color:'#6b7280' }}>{p.title}</div>
                          <span style={bdg('#f3f4f6','#9ca3af')}>Archived · {p.version}</span>
                        </div>
                        {p.archived_note && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Note: {p.archived_note}</div>}
                        {p.archived_at   && <div style={{ fontSize:11, color:'#9ca3af' }}>Archived: {new Date(p.archived_at).toLocaleDateString()}</div>}
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>{p.signers.length} signoff{p.signers.length!==1?'s':''} on record</div>
                    </div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {p.signers.map(s => (
                        <span key={s.user_id+s.signed_at} style={{ display:'inline-flex', padding:'2px 7px', borderRadius:5, fontSize:11, background:'#f3f4f6', color:'#6b7280' }}>
                          ✓ {s.u?s.u.name:s.user_name} · {new Date(s.signed_at).toLocaleDateString()}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {rt==='users' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr><Th>Staff Member</Th><Th>Dept</Th><Th>Signed</Th><Th>Pending</Th><Th>Forms</Th><Th>Score</Th></tr></thead>
            <tbody>{userRep.map(u=>{ const sc=Math.round(u.signed.length/Math.max(activePolicies.length,1)*100); return (
              <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <Td><div style={{ fontWeight:500 }}>{u.name}</div><div style={{ fontSize:10, color:'#6b7280' }}>{u.email}</div></Td>
                <Td style={{ fontSize:12 }}>{u.dept}</Td>
                <Td><span style={bdg('#d1fae5','#059669')}>{u.signed.length}</span></Td>
                <Td><span style={bdg(u.unsigned.length>0?'#fee2e2':'#f3f4f6',u.unsigned.length>0?'#dc2626':'#6b7280')}>{u.unsigned.length}</span></Td>
                <Td><span style={bdg('#dbeafe','#2563eb')}>{u.forms.length}</span></Td>
                <Td><div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ flex:1, background:'#f3f4f6', borderRadius:4, height:6 }}><div style={{ width:`${sc}%`, height:'100%', borderRadius:4, background:sc===100?'#059669':sc>60?'#d97706':'#dc2626' }} /></div><span style={{ fontSize:11, fontWeight:600, color:NAV, width:34 }}>{sc}%</span></div></Td>
              </tr>);
            })}</tbody>
          </table>
        </div>
      )}

      {rt==='forms' && (
        <div style={{ ...S.card, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead><tr><Th>Ref</Th><Th>Form Title</Th><Th>Frequency</Th><Th>Submissions</Th><Th>Last Submitted</Th></tr></thead>
            <tbody>{formRep.map(f=>(
              <tr key={f.ref} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <Td style={{ fontWeight:700, color:GOLD }}>{f.ref}</Td>
                <Td style={{ fontWeight:500 }}>{f.title}</Td>
                <Td><span style={pll(FREQ_CLR[f.freq]||'#6b7280')}>{f.freq}</span></Td>
                <Td><span style={bdg(f.subs.length>0?'#dbeafe':'#f3f4f6',f.subs.length>0?'#2563eb':'#6b7280')}>{f.subs.length}</span></Td>
                <Td style={{ color:'#6b7280', fontSize:11 }}>{f.last?`${new Date(f.last.submittedAt).toLocaleDateString()} · ${f.last.submittedByName}`:'Not yet submitted'}</Td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── My Activity (staff-only personal view) ────────────────────────────────────
function MyActivity({ user, policies, signoffs, submissions }) {
  const forms      = useForms();
  const [tab, setTab] = useState('forms');

  const mySignoffs  = signoffs.filter(s => s.user_id === user.id);
  const mySubs      = submissions.filter(s => s.submittedBy === user.id);
  const activePols  = policies.filter(p => !p.status || p.status === 'active');
  const signedPols  = activePols.filter(p => mySignoffs.find(s => s.policy_id === p.id));
  const unsignedPols= activePols.filter(p => !mySignoffs.find(s => s.policy_id === p.id));
  const pct         = Math.round(signedPols.length / Math.max(activePols.length, 1) * 100);

  const tabStyle = active => ({
    display:'inline-flex', alignItems:'center', gap:5, padding:'7px 13px',
    cursor:'pointer', fontSize:12.5,
    borderBottom:`2.5px solid ${active ? GOLD : 'transparent'}`,
    color: active ? NAV : '#6b7280', fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ padding:26 }}>
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, color:NAV }}>My Activity</div>
        <div style={{ fontSize:12.5, color:'#6b7280', marginTop:3 }}>Your personal compliance record</div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:26 }}>
        {[
          { label:'Policies Signed',    v:`${signedPols.length} / ${activePols.length}`, c:'#059669', sub:`${pct}% compliant` },
          { label:'Policies Pending',   v:unsignedPols.length, c:unsignedPols.length>0?'#dc2626':'#059669', sub:unsignedPols.length>0?'Action needed':'All up to date' },
          { label:'Forms Submitted',    v:mySubs.length, c:'#2563eb', sub:'Total submissions' },
        ].map((s,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:10, padding:20, borderLeft:`4px solid ${s.c}`, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize:28, fontWeight:700, color:s.c, fontFamily:"'Playfair Display',serif" }}>{s.v}</div>
            <div style={{ fontSize:12.5, color:NAV, fontWeight:600, marginTop:3 }}>{s.label}</div>
            <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1.5px solid #e5e7eb', marginBottom:18 }}>
        <div style={tabStyle(tab==='forms')}    onClick={() => setTab('forms')}><Icon name="form" size={13} /> My Submissions</div>
        <div style={tabStyle(tab==='policies')} onClick={() => setTab('policies')}><Icon name="shield" size={13} /> My Policy Status</div>
      </div>

      {/* My Submissions */}
      {tab === 'forms' && (
        <div style={{ background:'#fff', borderRadius:10, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
            <thead>
              <tr><Th>Ref</Th><Th>Form Name</Th><Th>Submitted</Th><Th>Status</Th></tr>
            </thead>
            <tbody>
              {mySubs.length === 0
                ? <tr><td colSpan={4} style={{ textAlign:'center', color:'#6b7280', padding:34 }}>You have not submitted any forms yet.</td></tr>
                : mySubs.sort((a,b) => new Date(b.submittedAt)-new Date(a.submittedAt)).map(s => {
                    const f  = forms.find(f => f.ref === s.formRef);
                    const sm = WF_STATUS[s.wfStatus || 'no_workflow'];
                    return (
                      <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                        <Td style={{ fontWeight:700, color:GOLD }}>{s.formRef}</Td>
                        <Td style={{ fontWeight:500 }}>{f ? f.title : s.formRef}</Td>
                        <Td style={{ color:'#6b7280', fontSize:11.5 }}>{new Date(s.submittedAt).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</Td>
                        <Td><span style={bdg(sm.bg, sm.color)}>{sm.label}</span></Td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      )}

      {/* My Policy Status */}
      {tab === 'policies' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {/* Compliance score */}
          <div style={{ background:'#fff', borderRadius:10, padding:18, boxShadow:'0 1px 3px rgba(0,0,0,0.08)', marginBottom:6 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:13.5, fontWeight:600, color:NAV }}>Overall Policy Compliance</div>
              <div style={{ fontSize:26, fontWeight:700, color:pct===100?'#059669':pct>60?'#d97706':'#dc2626', fontFamily:"'Playfair Display',serif" }}>{pct}%</div>
            </div>
            <div style={{ background:'#f3f4f6', borderRadius:4, height:8 }}>
              <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background:pct===100?'#059669':pct>60?'#d97706':'#dc2626', transition:'width 0.5s' }} />
            </div>
          </div>

          {/* Pending */}
          {unsignedPols.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#dc2626', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                Pending Acknowledgement ({unsignedPols.length})
              </div>
              {unsignedPols.map(p => (
                <div key={p.id} style={{ background:'#fff', borderRadius:9, padding:'13px 16px', marginBottom:7, border:'1.5px solid #fecaca', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:NAV }}>{p.title}</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{p.category} · {p.version}</div>
                  </div>
                  <span style={bdg('#fee2e2','#dc2626')}>Pending</span>
                </div>
              ))}
            </div>
          )}

          {/* Signed */}
          {signedPols.length > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#059669', textTransform:'uppercase', letterSpacing:1, marginBottom:8, marginTop:8 }}>
                Acknowledged ({signedPols.length})
              </div>
              {signedPols.map(p => {
                const s = mySignoffs.find(s => s.policy_id === p.id);
                return (
                  <div key={p.id} style={{ background:'#fff', borderRadius:9, padding:'13px 16px', marginBottom:7, border:'1.5px solid #86efac', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13, color:NAV }}>{p.title}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{p.category} · {p.version}{s ? ` · Signed ${new Date(s.signed_at).toLocaleDateString('en-GB')}` : ''}</div>
                    </div>
                    <span style={bdg('#d1fae5','#059669')}>✓ Signed</span>
                  </div>
                );
              })}
            </div>
          )}

          {activePols.length === 0 && (
            <div style={{ background:'#fff', borderRadius:10, padding:32, textAlign:'center', color:'#6b7280' }}>No active policies found.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin Users ────────────────────────────────────────────────────────────────
function AdminUsers({ users, setUsers, currentUser }) {
  const DEPTS = ['Compliance','Trading','Finance & Accounts','IT','Operations','HR','Risk','Internal Control','Audit','Board','Management'];

  const [showAdd,    setShowAdd]    = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [delTarget,  setDelTarget]  = useState(null);
  const [resetTarget,setResetTarget]= useState(null);
  const [saving,     setSaving]     = useState(false);
  const [q,          setQ]          = useState('');

  const [nu, setNu] = useState({ name:'', email:'', role:'staff', dept:'Compliance', lineManager:'' });
  const [eu, setEu] = useState({ name:'', email:'', role:'staff', dept:'Compliance', lineManager:'' });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(q.toLowerCase()) ||
    u.email.toLowerCase().includes(q.toLowerCase()) ||
    u.dept.toLowerCase().includes(q.toLowerCase())
  );

  // ── Add ────────────────────────────────────────────────────────────────────
  async function addUser() {
    if (!nu.name || !nu.email) return;
    setSaving(true);
    const id = `u${Date.now()}`;
    const { error } = await dbAddUser({ id, name:nu.name, email:nu.email, role:nu.role, dept:nu.dept });
    if (!error) {
      setUsers(prev => [...prev, { id, name:nu.name, email:nu.email, role:nu.role, dept:nu.dept, pw:'Transworld!23', mustChange:true }]);
      setShowAdd(false);
      setNu({ name:'', email:'', role:'staff', dept:'Compliance' });
    } else {
      alert('Could not add user. The email address may already be in use.');
    }
    setSaving(false);
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  function openEdit(u) {
    setEu({ name:u.name, email:u.email, role:u.role, dept:u.dept, lineManager:u.lineManager||'' });
    setEditTarget(u);
  }
  async function saveEdit() {
    if (!eu.name || !eu.email) return;
    setSaving(true);
    const { error } = await dbEditUser({ id:editTarget.id, name:eu.name, email:eu.email, role:eu.role, dept:eu.dept, lineManager:eu.lineManager||null });
    if (!error) {
      setUsers(prev => prev.map(u => u.id === editTarget.id ? { ...u, name:eu.name, email:eu.email, role:eu.role, dept:eu.dept, lineManager:eu.lineManager||null } : u));
      setEditTarget(null);
    } else {
      alert('Could not save changes. The email address may already be in use.');
    }
    setSaving(false);
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!delTarget) return;
    setSaving(true);
    const { error } = await dbDeleteUser(delTarget.id);
    if (!error) {
      setUsers(prev => prev.filter(u => u.id !== delTarget.id));
      setDelTarget(null);
    } else {
      alert('Could not delete user. They may have form submissions on record.');
    }
    setSaving(false);
  }

  // ── Reset password ─────────────────────────────────────────────────────────
  async function confirmReset() {
    if (!resetTarget) return;
    setSaving(true);
    const { error } = await dbResetPassword(resetTarget.id);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === resetTarget.id ? { ...u, mustChange:true, pw:'Transworld!23' } : u));
      setResetTarget(null);
    }
    setSaving(false);
  }

  // ── Shared user form fields ────────────────────────────────────────────────
  function UserFields({ vals, setVals, disableEmail, isEdit }) {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div>
          <label style={lbl()}>Full Name</label>
          <input style={inp()} value={vals.name} onChange={e => setVals({ ...vals, name:e.target.value })} placeholder="Full name" />
        </div>
        <div>
          <label style={lbl()}>Work Email</label>
          <input style={{ ...inp(), opacity: disableEmail ? 0.6 : 1 }} type="email"
            value={vals.email} onChange={e => setVals({ ...vals, email:e.target.value })}
            placeholder="email@transworldltd.com.ng" disabled={disableEmail} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={lbl()}>Department</label>
            <select style={inp()} value={vals.dept} onChange={e => setVals({ ...vals, dept:e.target.value })}>
              {DEPTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl()}>Role</label>
            <select style={inp()} value={vals.role} onChange={e => setVals({ ...vals, role:e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div>
          <label style={lbl()}>Line Manager / L1 Approver</label>
          <select style={inp()} value={vals.lineManager || ''} onChange={e => setVals({ ...vals, lineManager:e.target.value })}>
            <option value="">— No line manager assigned —</option>
            {users.filter(u => u.email !== vals.email).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.dept})</option>
            ))}
          </select>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>This person will be the L1 reviewer for all forms submitted by this user.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:NAV }}>User Management</div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>Add, edit or remove staff access to the portal</div>
        </div>
        <button style={btn('primary')} onClick={() => { setNu({ name:'', email:'', role:'staff', dept:'Compliance' }); setShowAdd(true); }}>
          <Icon name="plus" size={14} /> Add User
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom:14 }}>
        <input style={{ ...inp(), maxWidth:300 }} placeholder="Search by name, email or department..." value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {/* Users table */}
      <div style={{ ...S.card, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead>
            <tr>
              <Th>Name</Th><Th>Email</Th><Th>Dept</Th><Th>Role</Th><Th>Line Manager</Th><Th>PW</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <Td style={{ fontWeight:500 }}>{u.name}</Td>
                <Td style={{ color:'#6b7280', fontSize:11.5 }}>{u.email}</Td>
                <Td>{u.dept}</Td>
                <Td>
                  <span style={bdg(u.role==='admin'?'#fef3c7':'#dbeafe', u.role==='admin'?'#92400e':'#1e40af')}>
                    {u.role}
                  </span>
                </Td>
                <Td>
                  <span style={bdg(u.mustChange?'#fee2e2':'#d1fae5', u.mustChange?'#dc2626':'#059669')}>
                    {u.mustChange ? 'Default' : 'Set'}
                  </span>
                </Td>
                <Td style={{ fontSize:11.5 }}>
                  {u.lineManager
                    ? <span style={bdg('#f0f4ff','#3730a3')}>{uName(users, u.lineManager)}</span>
                    : <span style={{ color:'#9ca3af' }}>Not assigned</span>}
                </Td>
                <Td>
                  <div style={{ display:'flex', gap:6 }}>
                    {/* Edit */}
                    <button style={{ ...btn('outline'), padding:'5px 10px', fontSize:11 }} onClick={() => openEdit(u)}>
                      Edit
                    </button>
                    {/* Reset password */}
                    <button
                      style={{ ...btn('outline'), padding:'5px 10px', fontSize:11, color:'#d97706', borderColor:'#fde68a' }}
                      onClick={() => setResetTarget(u)}
                      title="Reset to default password">
                      Reset PW
                    </button>
                    {/* Delete — cannot delete yourself */}
                    {u.id !== currentUser.id && (
                      <button
                        style={{ ...btn('outline'), padding:'5px 10px', fontSize:11, color:'#dc2626', borderColor:'#fecaca' }}
                        onClick={() => setDelTarget(u)}>
                        Delete
                      </button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Add user modal ────────────────────────────────────────────────── */}
      {showAdd && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:460 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Add New User</div>
              <button style={btn('outline')} onClick={() => setShowAdd(false)}><Icon name="x" size={14} /></button>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <UserFields vals={nu} setVals={setNu} disableEmail={false} />
              <div style={{ marginTop:12, fontSize:12, color:'#6b7280', padding:'8px 10px', background:'#f9fafb', borderRadius:6 }}>
                New user will be assigned default password: <strong>Transworld!23</strong>
              </div>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
              <button style={btn('outline')} onClick={() => setShowAdd(false)} disabled={saving}>Cancel</button>
              <button style={{ ...btn('primary'), opacity:saving?0.6:1 }} onClick={addUser} disabled={saving}>
                {saving ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit user modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:460 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Edit User</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{editTarget.email}</div>
              </div>
              <button style={btn('outline')} onClick={() => setEditTarget(null)}><Icon name="x" size={14} /></button>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <UserFields vals={eu} setVals={setEu} disableEmail={false} />
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
              <button style={btn('outline')} onClick={() => setEditTarget(null)} disabled={saving}>Cancel</button>
              <button style={{ ...btn('primary'), opacity:saving?0.6:1 }} onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset password confirmation ───────────────────────────────────── */}
      {resetTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:420 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Reset Password</div>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>
                This will reset <strong>{resetTarget.name}</strong>'s password back to the default:
              </p>
              <div style={{ margin:'14px 0', padding:'11px 14px', background:'#f9fafb', borderRadius:8, fontFamily:'monospace', fontSize:15, fontWeight:700, color:NAV, textAlign:'center' }}>
                Transworld!23
              </div>
              <p style={{ fontSize:12, color:'#6b7280' }}>
                They will be required to set a new personal password on their next login.
              </p>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
              <button style={btn('outline')} onClick={() => setResetTarget(null)} disabled={saving}>Cancel</button>
              <button style={{ ...btn('gold'), opacity:saving?0.6:1 }} onClick={confirmReset} disabled={saving}>
                {saving ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ───────────────────────────────────────────── */}
      {delTarget && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:420 }}>
            <div style={{ padding:'18px 22px', borderBottom:'1px solid #e5e7eb' }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:NAV }}>Delete User</div>
            </div>
            <div style={{ padding:'20px 22px' }}>
              <div style={{ padding:'12px 14px', background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:8, marginBottom:14, fontSize:13, color:'#92400e' }}>
                <strong>You are about to delete:</strong> {delTarget.name} ({delTarget.email})
              </div>
              <p style={{ fontSize:13, color:'#374151', lineHeight:1.6, marginBottom:10 }}>
                This will permanently remove their account and sign-in access. Their policy acknowledgements will be retained in the audit trail, but their account will no longer exist.
              </p>
              <p style={{ fontSize:12, color:'#dc2626', fontWeight:500 }}>
                This action cannot be undone.
              </p>
            </div>
            <div style={{ padding:'14px 22px', borderTop:'1px solid #e5e7eb', display:'flex', gap:9, justifyContent:'flex-end' }}>
              <button style={btn('outline')} onClick={() => setDelTarget(null)} disabled={saving}>Cancel</button>
              <button style={{ ...btn('danger'), background:'#dc2626', color:'#fff', opacity:saving?0.6:1 }} onClick={confirmDelete} disabled={saving}>
                {saving ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user,        setUser]        = useState(null);
  const [page,        setPage]        = useState('dashboard');
  const [policies,    setPolicies]    = useState([]);
  const [signoffs,    setSignoffs]    = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [users,       setUsers]       = useState([]);
  const [wfConfigs,   setWfConfigs]   = useState({});
  const [formConfigs, setFormConfigs] = useState({});
  const [allForms,    setAllForms]    = useState(FORMS); // live editable forms
  const [doaConfig,   setDoaConfig]   = useState({ financeUser:null, complianceUser:null, mdUser:null, chairmanUser:null });
  const [loaded,      setLoaded]      = useState(false);
  const [dbError,     setDbError]     = useState(false);
  const [showHelp,    setShowHelp]    = useState(false);

  useEffect(() => {
    Promise.all([
      dbLoadAll(),
      dbLoadFormConfigs(),
      dbLoadForms(),
      dbLoadDoaConfig(),
    ]).then(async ([data, fc, dbForms, doa]) => {
      setPolicies(data.policies);
      setSignoffs(data.signoffs);
      setUsers(data.users);
      setSubmissions(data.submissions);
      setWfConfigs(data.wfConfigs);
      setFormConfigs(fc);
      setDoaConfig(doa);

      if (dbForms.length === 0) {
        await dbSeedForms(FORMS);
        setAllForms(FORMS);
      } else {
        setAllForms(dbForms);
      }

      setLoaded(true);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setDbError(true);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:NAV }}>
      <div style={{ color:GOLD, fontSize:14, fontFamily:'sans-serif' }}>Loading Transworld Portal...</div>
    </div>
  );

  if (dbError) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#fff' }}>
      <div style={{ textAlign:'center', maxWidth:400 }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:NAV, marginBottom:12 }}>Cannot connect to database</div>
        <div style={{ fontSize:13, color:'#6b7280' }}>Please check that VITE_SUPABASE_URL and VITE_SUPABASE_KEY are set in Vercel environment variables.</div>
      </div>
    </div>
  );

  if (!user) return <Login users={users} onLogin={u => { setUser(u); setPage('dashboard'); }} />;
  if (user.mustChange) return <ChangePw forced user={user} users={users} setUsers={setUsers} onDone={u => setUser(u)} />;

  const inboxCount   = submissions.filter(s => getApprover(s) === user.id).length;
  const pendingPolCt = policies.filter(p => !p.status || p.status==='active').filter(p => !signoffs.find(s => s.policy_id===p.id && s.user_id===user.id)).length;

  const navItems = [
    { key:'dashboard', label:'Dashboard',     icon:'home' },
    { key:'policies',  label:'Policy Library', icon:'doc',   section:'COMPLIANCE' },
    { key:'forms',     label:'Forms',           icon:'form' },
    { key:'inbox',     label:'My Inbox',         icon:'inbox', badge:inboxCount },
    ...(user.role === 'admin' ? [
      { key:'wfDash',      label:'Workflow Dashboard', icon:'flow',  section:'ADMINISTRATION' },
      { key:'wfSetup',     label:'Workflow Setup',      icon:'cog' },
      { key:'formBuilder', label:'Form Builder',        icon:'form' },
      { key:'reports',     label:'Reports',             icon:'chart' },
      { key:'users',       label:'User Management',     icon:'users' },
    ] : [
      { key:'reports', label:'My Activity', icon:'chart', section:'MY RECORDS' },
    ]),
    { key:'help',     label:'Help Centre',    icon:'book',  section:'SUPPORT' },
    { key:'changepw', label:'Change Password', icon:'lock',  section:'ACCOUNT' },
  ];

  return (
    <FormsCtx.Provider value={allForms}>
    <div style={{ display:'flex' }}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={{ padding:'18px 17px 16px', borderBottom:'1px solid rgba(201,168,76,0.14)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:32, height:32, background:GOLD, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Icon name="shield" size={17} color={NAV} />
            </div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:13.5, color:GOLD, lineHeight:1.3 }}>Transworld IS Ltd</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:2, textTransform:'uppercase', marginTop:1 }}>Control Portal</div>
            </div>
          </div>
        </div>
        <div style={{ flex:1, padding:'9px 0', overflowY:'auto' }}>
          {navItems.map(item => (
            <div key={item.key}>
              {item.section && <div style={{ padding:'13px 17px 4px', fontSize:9, color:'rgba(255,255,255,0.27)', letterSpacing:2, textTransform:'uppercase' }}>{item.section}</div>}
              <div onClick={() => { setPage(item.key); setShowHelp(false); }}
                style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 17px', cursor:'pointer', color:page===item.key?GOLD:'rgba(255,255,255,0.55)', fontSize:12.5, transition:'all 0.15s', borderLeft:`3px solid ${page===item.key?GOLD:'transparent'}`, background:page===item.key?'rgba(201,168,76,0.12)':'transparent', fontWeight:page===item.key?500:400 }}>
                <Icon name={item.icon} size={15} />
                <span style={{ flex:1 }}>{item.label}</span>
                {item.key==='policies' && pendingPolCt>0 && <span style={{ background:'#dc2626', color:'#fff', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>{pendingPolCt}</span>}
                {item.badge>0 && <span style={{ background:'#d97706', color:'#fff', fontSize:9, fontWeight:700, padding:'1px 5px', borderRadius:8 }}>{item.badge}</span>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'13px 17px', borderTop:'1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:9 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', background:GOLD, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:NAV }}>{user.name.charAt(0)}</div>
            <div>
              <div style={{ color:'#fff', fontSize:12, fontWeight:500 }}>{user.name}</div>
              <div style={{ color:'rgba(255,255,255,0.37)', fontSize:10 }}>{user.dept}</div>
            </div>
          </div>
          <div onClick={() => { setUser(null); setPage('dashboard'); }}
            style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 9px', borderRadius:5, background:'rgba(255,255,255,0.05)', cursor:'pointer', color:'rgba(255,255,255,0.55)', fontSize:12 }}>
            <Icon name="logout" size={13} /> Sign Out
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        {/* Top bar */}
        <div style={S.topbar}>
          <div style={{ fontSize:13, fontWeight:600, color:NAV }}>
            {(navItems.find(n=>n.key===page)||{}).label || 'Dashboard'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:13 }}>
            {inboxCount>0    && <div style={{ fontSize:12, color:'#d97706', fontWeight:500 }}>Inbox: {inboxCount} awaiting action</div>}
            {pendingPolCt>0  && <div style={{ fontSize:12, color:'#dc2626', fontWeight:500 }}>{pendingPolCt} policy acknowledgement{pendingPolCt>1?'s':''} pending</div>}
            <span style={bdg(user.role==='admin'?'#fef3c7':'#dbeafe', user.role==='admin'?'#92400e':'#1e40af')}>{user.role}</span>
            {/* Context help button */}
            <button onClick={() => setShowHelp(!showHelp)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 12px', borderRadius:7, border:'1.5px solid', borderColor:showHelp?NAV:'#d1d5db', background:showHelp?NAV:'#fff', color:showHelp?'#fff':'#374151', fontSize:12, fontWeight:500, cursor:'pointer' }}>
              <Icon name="question" size={14} color={showHelp?'#fff':'#374151'} /> Help
            </button>
          </div>
        </div>

        {/* Page content */}
        {page==='dashboard' && <Dashboard user={user} policies={policies} signoffs={signoffs} submissions={submissions} />}
        {page==='policies'  && <Policies user={user} policies={policies} setPolicies={setPolicies} signoffs={signoffs} setSignoffs={setSignoffs} />}
        {page==='forms'     && <Forms user={user} submissions={submissions} setSubmissions={setSubmissions} wfConfigs={wfConfigs} users={users} formConfigs={formConfigs} setFormConfigs={setFormConfigs} doaConfig={doaConfig} />}
        {page==='inbox'     && <MyInbox user={user} submissions={submissions} setSubmissions={setSubmissions} users={users} doaConfig={doaConfig} />}
        {page==='wfDash'      && user.role==='admin' && <WorkflowDash submissions={submissions} setSubmissions={setSubmissions} users={users} />}
        {page==='wfSetup'     && user.role==='admin' && <WorkflowSetup users={users} wfConfigs={wfConfigs} setWfConfigs={setWfConfigs} doaConfig={doaConfig} setDoaConfig={setDoaConfig} />}
        {page==='formBuilder' && user.role==='admin' && <FormBuilder forms={allForms} setAllForms={setAllForms} submissions={submissions} />}
        {page==='reports'     && user.role==='admin' && <Reports policies={policies} signoffs={signoffs} submissions={submissions} users={users} />}
        {page==='reports'     && user.role!=='admin' && <MyActivity user={user} policies={policies} signoffs={signoffs} submissions={submissions} />}
        {page==='users'       && user.role==='admin' && <AdminUsers users={users} setUsers={setUsers} currentUser={user} />}
        {page==='help'      && <HelpPage setPage={setPage} />}
        {page==='changepw'  && (
          <div style={S.page}>
            <div style={{ maxWidth:490 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:21, color:NAV, marginBottom:4 }}>Change Password</div>
              <div style={{ fontSize:12, color:'#6b7280', marginBottom:22 }}>Update your personal portal password</div>
              <div style={{ ...S.card, padding:24 }}>
                <ChangePw user={user} users={users} setUsers={setUsers} onDone={u => { setUser(u); setPage('dashboard'); }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context-sensitive help panel — slides in from right */}
      {showHelp && page !== 'help' && (
        <HelpPanel page={page} onClose={() => setShowHelp(false)} />
      )}

      {/* Backdrop when help panel open */}
      {showHelp && page !== 'help' && (
        <div onClick={() => setShowHelp(false)}
          style={{ position:'fixed', inset:0, zIndex:199, background:'rgba(0,0,0,0.2)' }} />
      )}
    </div>
    </FormsCtx.Provider>
  );
}

