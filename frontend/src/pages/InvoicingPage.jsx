import React, { useState, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  FileText,
  Sparkles,
  Send,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Code,
  ExternalLink,
  Mail,
  DollarSign
} from 'lucide-react';
import { api } from '../services/api';

const SAMPLE_CONTRACTS = [
  {
    name: 'Acme Web & API Contract',
    text: `Acme Technologies requires 12 hours of React development at $60 per hour, four hours of API integration at $75 per hour, and a $150 deployment fee. Apply 8% tax. The client contact is accounts@acmetech.io. Net 15 days upon receipt.`,
    email: 'accounts@acmetech.io'
  },
  {
    name: 'CyberPulse Media Retainer',
    text: `CyberPulse Media scope: Monthly retainer setup fee of $1200, plus 20 hours of content curation at $45 per hour. Sales tax is 5%. Client billing email: billing@cyberpulse.io. Payment due in 14 days.`,
    email: 'billing@cyberpulse.io'
  },
  {
    name: 'CloudOps Infrastructure Scope',
    text: `CloudOps Architecture agreement: 15 hours of Terraform cloud orchestration at $120 per hour, plus a $850 Kubernetes cluster deployment fee. Tax rate is 0%. Send invoice to finance@cloudops.net.`,
    email: 'finance@cloudops.net'
  }
];

export default function InvoicingPage({ systemStatus }) {
  const [contractText, setContractText] = useState(SAMPLE_CONTRACTS[0].text);
  const [recipientEmail, setRecipientEmail] = useState(SAMPLE_CONTRACTS[0].email);
  const [loadingExtract, setLoadingExtract] = useState(false);
  
  // Invoice Draft State
  const [invoiceDraft, setInvoiceDraft] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [taxPercentage, setTaxPercentage] = useState(8);
  const [invoiceTitle, setInvoiceTitle] = useState('Professional Services Invoice');
  const [recipientName, setRecipientName] = useState('Acme Technologies');
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 15 days');
  const [notes, setNotes] = useState('Thank you for partnering with us.');

  // Invoice creation / send state
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [sentInvoice, setSentInvoice] = useState(null);
  const [invoiceError, setInvoiceError] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showConfirmSendModal, setShowConfirmSendModal] = useState(false);

  const gridRef = useRef();

  // Dynamic calculations
  const subtotal = useMemo(() => {
    return Number(lineItems.reduce((acc, item) => acc + (Number(item.quantity || 1) * Number(item.unitPrice || 0)), 0).toFixed(2));
  }, [lineItems]);

  const taxAmount = Number(((subtotal * Number(taxPercentage || 0)) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  // Run AI Extraction Agent
  async function handleExtractFromContract() {
    if (!contractText.trim()) return;
    setLoadingExtract(true);
    setInvoiceError(null);
    setSentInvoice(null);

    try {
      const res = await api.runContractToInvoice({ contractText, recipientEmail });
      setInvoiceDraft(res);
      setLineItems(res.lineItems || []);
      setRecipientName(res.recipientName || 'Client');
      if (res.recipientEmail) setRecipientEmail(res.recipientEmail);
      if (res.taxPercentage !== undefined) setTaxPercentage(res.taxPercentage);
      if (res.invoiceTitle) setInvoiceTitle(res.invoiceTitle);
      if (res.dueDate) setDueDate(res.dueDate);
      if (res.paymentTerms) setPaymentTerms(res.paymentTerms);
      if (res.notes) setNotes(res.notes);
    } catch (err) {
      setInvoiceError(err.message);
    } finally {
      setLoadingExtract(false);
    }
  }

  // AG Grid Line Item columns
  const columnDefs = useMemo(() => [
    {
      field: 'name',
      headerName: 'Item / Deliverable',
      flex: 2,
      minWidth: 180,
      editable: true,
      cellClass: 'text-xs font-semibold text-slate-200'
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 200,
      editable: true,
      cellClass: 'text-xs text-slate-400'
    },
    {
      field: 'quantity',
      headerName: 'Qty / Hrs',
      width: 100,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellClass: 'text-xs text-center font-bold text-amber-300 bg-slate-900/60'
    },
    {
      field: 'unitPrice',
      headerName: 'Rate / Unit',
      width: 110,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      valueFormatter: params => `$${Number(params.value || 0).toFixed(2)}`,
      cellClass: 'text-xs text-right font-medium text-slate-300 bg-slate-900/60'
    },
    {
      headerName: 'Subtotal',
      width: 120,
      valueGetter: params => {
        const q = Number(params.data.quantity) || 0;
        const p = Number(params.data.unitPrice) || 0;
        return Number((q * p).toFixed(2));
      },
      valueFormatter: params => `$${params.value?.toFixed(2)}`,
      cellClass: 'text-xs text-right font-semibold text-emerald-400'
    },
    {
      headerName: 'Action',
      width: 80,
      cellRenderer: params => {
        return (
          <button
            onClick={() => handleRemoveLineItem(params.node.rowIndex)}
            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
            title="Delete line item"
          >
            <Trash2 className="w-4 h-4 mt-1" />
          </button>
        );
      }
    }
  ], []);

  function handleCellValueChanged(params) {
    const updated = [...lineItems];
    const index = params.node.rowIndex;
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        quantity: Math.max(1, parseFloat(params.data.quantity) || 1),
        unitPrice: Math.max(0, parseFloat(params.data.unitPrice) || 0),
        subtotal: Number(((parseFloat(params.data.quantity) || 1) * (parseFloat(params.data.unitPrice) || 0)).toFixed(2))
      };
      setLineItems(updated);
    }
  }

  function handleAddLineItem() {
    setLineItems(prev => [
      ...prev,
      {
        name: 'Additional Milestone Item',
        description: 'Scope deliverables',
        quantity: 1,
        unitPrice: 100.00,
        subtotal: 100.00
      }
    ]);
  }

  function handleRemoveLineItem(index) {
    setLineItems(prev => prev.filter((_, idx) => idx !== index));
  }

  // Create & Dispatch PayPal Invoice
  async function handleSendInvoice(sendImmediately = true) {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      alert('Please enter a valid client recipient email.');
      return;
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item to the invoice.');
      return;
    }

    setSubmittingInvoice(true);
    setInvoiceError(null);
    setShowConfirmSendModal(false);

    try {
      const payload = {
        recipientName,
        recipientEmail,
        invoiceTitle,
        lineItems,
        currency: 'USD',
        taxPercentage: Number(taxPercentage) || 0,
        notes,
        dueDate,
        paymentTerms,
        sendImmediately,
        useSimulation: !systemStatus?.paypalConnected
      };

      const res = await api.createPayPalInvoice(payload);
      setSentInvoice(res);
    } catch (err) {
      setInvoiceError(err.message);
    } finally {
      setSubmittingInvoice(false);
    }
  }

  function copyToClipboard(text, isId = false) {
    navigator.clipboard.writeText(text);
    if (isId) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <FileText className="w-4 h-4" />
            <span>Merchant Workflow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Autonomous Contract-to-Invoice
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Convert contracts, project scopes, or meeting transcripts directly into verified PayPal Invoices.
          </p>
        </div>
      </div>

      {/* Input Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="text-sm font-semibold text-slate-200">
            Paste Contract, Scope, or Meeting Notes
          </label>
          {/* Preset Samples */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Sample Scope:</span>
            {SAMPLE_CONTRACTS.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setContractText(sample.text);
                  setRecipientEmail(sample.email);
                }}
                className="px-2.5 py-1 text-xs bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                {sample.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <textarea
          rows={4}
          value={contractText}
          onChange={(e) => setContractText(e.target.value)}
          placeholder="Acme Technologies requires 12 hours of React development at $60 per hour, four hours of API integration at $75 per hour, and a $150 deployment fee. Apply 8% tax. The client contact is accounts@example.com."
          className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-sm leading-relaxed"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Client Recipient Email</label>
            <div className="relative">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="accounts@clientcorp.io"
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 text-xs font-mono"
              />
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="flex items-end justify-end">
            <button
              onClick={handleExtractFromContract}
              disabled={loadingExtract || !contractText.trim()}
              className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-paypal-blue hover:from-indigo-500 hover:to-paypal-lightBlue text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              {loadingExtract ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>Extract Milestones with AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* Missing Fields / AI Alert Banner */}
      {invoiceDraft && invoiceDraft.missingFields?.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-300 text-xs space-y-1">
          <div className="font-semibold flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>AI Ambiguity & Missing Fields Notice:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-200/80 pl-2">
            {invoiceDraft.missingFields.map((field, idx) => (
              <li key={idx}>{field}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Invoice Editor & AG Grid Workspace */}
      {lineItems.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white font-heading">
                Structured Invoice Draft
              </h2>
              <p className="text-xs text-slate-400">
                Review and modify line items, tax percentage, and terms before official PayPal creation.
              </p>
            </div>
            <button
              onClick={handleAddLineItem}
              className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Line</span>
            </button>
          </div>

          {/* Header Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Invoice Title</label>
              <input
                type="text"
                value={invoiceTitle}
                onChange={(e) => setInvoiceTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Client Business Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Sales Tax %</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="100"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Line Items AG Grid */}
          <div className="ag-theme-quartz-dark w-full h-64 rounded-xl overflow-hidden border border-slate-800">
            <AgGridReact
              ref={gridRef}
              rowData={lineItems}
              columnDefs={columnDefs}
              onCellValueChanged={handleCellValueChanged}
              animateRows={true}
              overlayNoRowsTemplate="<span class='text-slate-500 text-xs'>No line items found.</span>"
            />
          </div>

          {/* Invoice Summary Totals */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 block font-medium">Payment Terms:</span>
              <span className="text-slate-200 font-mono">{paymentTerms || 'Due on receipt'}</span>
            </div>

            <div className="space-y-1 text-right sm:min-w-[200px]">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Tax ({taxPercentage}%):</span>
                <span className="font-mono">${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                <span>Total Invoice Due:</span>
                <span className="font-mono text-emerald-400">${totalAmount.toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          {/* Actions & Dispatch */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              onClick={() => handleSendInvoice(false)}
              disabled={submittingInvoice}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
            >
              Save Draft Only
            </button>
            <button
              onClick={() => setShowConfirmSendModal(true)}
              disabled={submittingInvoice}
              className="flex items-center space-x-2 px-6 py-2.5 bg-paypal-blue hover:bg-paypal-lightBlue text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
            >
              {submittingInvoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Create & Dispatch PayPal Invoice</span>
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white font-heading">Confirm PayPal Invoice Dispatch</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              You are about to generate and send an official invoice for <span className="text-emerald-400 font-bold">${totalAmount.toFixed(2)} USD</span> to <span className="text-white font-mono">{recipientEmail}</span>.
            </p>
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Client:</span>
                <span className="text-slate-200">{recipientName}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Items:</span>
                <span className="text-slate-200">{lineItems.length} deliverables</span>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowConfirmSendModal(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendInvoice(true)}
                className="px-5 py-2 text-xs font-bold bg-paypal-blue hover:bg-paypal-lightBlue text-white rounded-lg shadow-sm"
              >
                Authorize & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Created / Dispatched Success View */}
      {sentInvoice && (
        <div className="bg-slate-900 border border-emerald-900/60 rounded-2xl p-6 shadow-xl space-y-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-base font-heading">
              <CheckCircle2 className="w-5 h-5" />
              <span>PayPal Invoice {sentInvoice.status === 'SENT' ? 'Dispatched' : 'Created'} Successfully!</span>
            </div>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full">
              Status: {sentInvoice.status}
            </span>
          </div>

          {sentInvoice.mode === 'simulation' && (
            <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-300">
              ⚠️ <span className="font-semibold">SIMULATION — NOT A REAL PAYPAL TRANSACTION.</span> Invoice recorded in simulation ledger.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono">
            <div>
              <span className="text-slate-500 block text-[11px]">Invoice ID:</span>
              <div className="flex items-center space-x-2 text-slate-200 font-semibold mt-0.5">
                <span>{sentInvoice.invoiceId}</span>
                <button
                  onClick={() => copyToClipboard(sentInvoice.invoiceId, true)}
                  className="text-slate-400 hover:text-white"
                  title="Copy Invoice ID"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {copiedId && <span className="text-[10px] text-emerald-400">Copied!</span>}
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Total Billed:</span>
              <span className="text-emerald-400 font-bold text-sm mt-0.5 block">${sentInvoice.amount?.toFixed(2)} {sentInvoice.currency}</span>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Recipient:</span>
              <span className="text-slate-300 truncate mt-0.5 block">{sentInvoice.recipientEmail}</span>
            </div>
          </div>

          {/* Links & Raw Details */}
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              {sentInvoice.invoiceUrl && (
                <a
                  href={sentInvoice.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-paypal-blue hover:bg-paypal-lightBlue text-white font-semibold rounded-lg text-xs transition-colors"
                >
                  <span>Open Invoice Link</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {sentInvoice.invoiceUrl && (
                <button
                  onClick={() => copyToClipboard(sentInvoice.invoiceUrl, false)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Copied Link!' : 'Copy Link'}</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setShowJsonModal(true)}
              className="flex items-center space-x-1 text-slate-500 hover:text-slate-300 text-[11px]"
            >
              <Code className="w-3 h-3" />
              <span>Inspect API Response Payload</span>
            </button>
          </div>
        </div>
      )}

      {/* JSON Debugging Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white font-mono">Invoice API Response Details</h4>
              <button onClick={() => setShowJsonModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] font-mono text-indigo-300 overflow-x-auto max-h-72">
              {JSON.stringify(sentInvoice, null, 2)}
            </pre>
          </div>
        </div>
      )}

    </div>
  );
}
