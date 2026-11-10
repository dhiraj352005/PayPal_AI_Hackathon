import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  BarChart3,
  Search,
  Download,
  RefreshCw,
  ShieldAlert,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  X
} from 'lucide-react';
import { api } from '../services/api';

export default function CommandCenterPage({ systemStatus }) {
  const [ledger, setLedger] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Selected Transaction for Detail Modal
  const [selectedTx, setSelectedTx] = useState(null);

  // Dispute Triage state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTargetTx, setDisputeTargetTx] = useState(null);
  const [customerClaim, setCustomerClaim] = useState('The order was charged twice on my account statement.');
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  
  // Refund Execution state
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('AI Dispute Resolution Approval');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(null);
  const [refundError, setRefundError] = useState(null);

  const gridRef = useRef();

  // Load ledger records
  async function fetchLedgerData() {
    setLoadingLedger(true);
    try {
      const res = await api.getLedger({
        search: searchText,
        type: typeFilter,
        mode: modeFilter,
        limit: 100
      });
      setLedger(res.records || []);
      setTotalRecords(res.total || 0);
    } catch (err) {
      console.error('Failed to load ledger:', err);
    } finally {
      setLoadingLedger(false);
    }
  }

  useEffect(() => {
    fetchLedgerData();
  }, [typeFilter, modeFilter]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchLedgerData();
  }

  // Quick Metrics
  const metrics = useMemo(() => {
    let totalVolume = 0;
    let ordersCount = 0;
    let capturesCount = 0;
    let invoicesCount = 0;
    let refundsCount = 0;

    ledger.forEach(tx => {
      if (tx.type === 'CAPTURE') {
        totalVolume += (tx.amount || 0);
        capturesCount++;
      } else if (tx.type === 'ORDER') {
        ordersCount++;
      } else if (tx.type === 'INVOICE') {
        invoicesCount++;
      } else if (tx.type === 'REFUND') {
        refundsCount++;
      }
    });

    return {
      totalVolume,
      ordersCount,
      capturesCount,
      invoicesCount,
      refundsCount
    };
  }, [ledger]);

  // AG Grid columns
  const columnDefs = useMemo(() => [
    {
      field: 'type',
      headerName: 'Type',
      width: 110,
      cellRenderer: params => {
        const type = params.value;
        const colorMap = {
          ORDER: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
          CAPTURE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          INVOICE: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
          REFUND: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        };
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${colorMap[type] || 'bg-slate-800 text-slate-300'}`}>
            {type}
          </span>
        );
      }
    },
    {
      field: 'id',
      headerName: 'Transaction ID',
      width: 170,
      cellClass: 'font-mono text-xs text-indigo-300 font-semibold'
    },
    {
      field: 'mode',
      headerName: 'Mode',
      width: 110,
      cellRenderer: params => {
        const isSim = params.value === 'simulation';
        return (
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
            isSim ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
          }`}>
            {isSim ? 'SIMULATION' : 'REAL'}
          </span>
        );
      }
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 200,
      cellClass: 'text-xs text-slate-300'
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: params => params.value ? `$${params.value.toFixed(2)}` : '$0.00',
      cellClass: 'text-xs font-mono font-bold text-right text-emerald-400'
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      cellRenderer: params => {
        return (
          <span className="font-mono text-[11px] text-slate-300 uppercase">
            {params.value}
          </span>
        );
      }
    },
    {
      field: 'createdAt',
      headerName: 'Timestamp',
      width: 150,
      valueFormatter: params => params.value ? new Date(params.value).toLocaleString() : 'N/A',
      cellClass: 'text-xs text-slate-400 font-mono'
    },
    {
      headerName: 'Actions',
      width: 140,
      cellRenderer: params => {
        const data = params.data;
        return (
          <div className="flex items-center space-x-1.5 mt-1">
            <button
              onClick={() => setSelectedTx(data)}
              className="p-1 text-slate-400 hover:text-white"
              title="View Details"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            {(data.type === 'CAPTURE' || data.type === 'ORDER') && (
              <button
                onClick={() => openDisputeModal(data)}
                className="px-2 py-0.5 bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/60 rounded text-[10px] text-rose-300 font-medium transition-colors"
                title="AI Dispute & Refund"
              >
                Dispute
              </button>
            )}
          </div>
        );
      }
    }
  ], []);

  // Export to CSV
  function handleExportCsv() {
    if (gridRef.current?.api) {
      gridRef.current.api.exportDataAsCsv({
        fileName: `payflow_ledger_export_${Date.now()}.csv`
      });
    }
  }

  // Open Dispute Modal
  function openDisputeModal(tx) {
    setDisputeTargetTx(tx);
    setTriageResult(null);
    setRefundSuccess(null);
    setRefundError(null);
    setCustomerClaim('The order was charged twice on my account statement.');
    setShowDisputeModal(true);
  }

  // Run AI Dispute Triage
  async function handleRunTriage() {
    if (!disputeTargetTx?.id) return;
    setTriageLoading(true);
    setRefundSuccess(null);
    setRefundError(null);

    try {
      const res = await api.runDisputeTriage({
        orderId: disputeTargetTx.id,
        customerClaim
      });
      setTriageResult(res);
      setRefundAmount(res.maxRefundableAmount?.toString() || '0');
    } catch (err) {
      alert(`Triage error: ${err.message}`);
    } finally {
      setTriageLoading(false);
    }
  }

  // Process Refund
  async function handleExecuteRefund() {
    if (!triageResult?.targetCaptureId) {
      alert('No eligible capture identified for refund.');
      return;
    }

    const amt = parseFloat(refundAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid refund amount.');
      return;
    }

    setRefundLoading(true);
    setRefundError(null);
    setRefundSuccess(null);

    try {
      const res = await api.refundPayment({
        captureId: triageResult.targetCaptureId,
        amount: amt,
        reason: refundReason
      });
      setRefundSuccess(res);
      fetchLedgerData();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setRefundLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <BarChart3 className="w-4 h-4" />
            <span>Command Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Financial Command Center & AI Dispute Resolver
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Unified transaction ledger across orders, captures, invoices, and refunds. Audit operations and triage disputes with AI.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchLedgerData}
            disabled={loadingLedger}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingLedger ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Total Volume Captured</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            ${metrics.totalVolume.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Confirmed settlement volume</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Procurement Orders</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-paypal-lightBlue mt-1">
            {metrics.ordersCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Buyer workflows initiated</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Invoices Issued</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-indigo-400 mt-1">
            {metrics.invoicesCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Merchant milestone billings</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <div className="text-xs text-slate-400 font-medium">Refunds Executed</div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-rose-400 mt-1">
            {metrics.refundsCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Post-triage resolution events</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Search by ID, customer, description..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-indigo-500"
          />
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
        </form>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="ORDER">Orders</option>
            <option value="CAPTURE">Captures</option>
            <option value="INVOICE">Invoices</option>
            <option value="REFUND">Refunds</option>
          </select>

          {/* Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-slate-300 text-xs focus:outline-none"
          >
            <option value="ALL">All Modes</option>
            <option value="real">Real PayPal</option>
            <option value="simulation">Simulation (DEMO)</option>
          </select>
        </div>
      </div>

      {/* AG Grid Transaction Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-heading">
            Live Transaction Ledger ({totalRecords} records)
          </h2>
          <span className="text-xs text-slate-500">Click column headers to sort</span>
        </div>

        <div className="ag-theme-quartz-dark w-full h-96 rounded-xl overflow-hidden border border-slate-800">
          <AgGridReact
            ref={gridRef}
            rowData={ledger}
            columnDefs={columnDefs}
            animateRows={true}
            overlayNoRowsTemplate="<span class='text-slate-500 text-xs'>No ledger records match the current filters.</span>"
          />
        </div>
      </div>

      {/* Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white font-heading">Transaction Details</h3>
              </div>
              <button onClick={() => setSelectedTx(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">Record ID</span>
                  <span className="text-indigo-300 font-semibold">{selectedTx.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Provider ID</span>
                  <span className="text-slate-300">{selectedTx.providerId || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Type</span>
                  <span className="text-slate-200">{selectedTx.type}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Mode</span>
                  <span className={selectedTx.mode === 'simulation' ? 'text-amber-400' : 'text-emerald-400'}>
                    {selectedTx.mode?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Amount</span>
                  <span className="text-emerald-400 font-bold">${selectedTx.amount?.toFixed(2)} {selectedTx.currency}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Status</span>
                  <span className="text-white font-semibold">{selectedTx.status}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 block text-[11px] mb-1">Description</span>
                <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  {selectedTx.description}
                </p>
              </div>

              {selectedTx.aiSummary && (
                <div>
                  <span className="text-slate-500 block text-[11px] mb-1">AI Execution Summary</span>
                  <p className="text-indigo-300 bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/40">
                    {selectedTx.aiSummary}
                  </p>
                </div>
              )}

              {selectedTx.items?.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[11px] mb-1">Item Breakdown ({selectedTx.items.length})</span>
                  <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                    {selectedTx.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-300 text-[11px]">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="font-mono">${(it.unitPrice * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Dispute Resolver Modal */}
      {showDisputeModal && disputeTargetTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2 text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="text-base font-bold text-white font-heading">AI Dispute Triage & Refund Resolver</h3>
              </div>
              <button onClick={() => setShowDisputeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Transaction Card */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-indigo-300 font-semibold">{disputeTargetTx.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Captured Amount:</span>
                <span className="font-mono text-emerald-400 font-bold">${disputeTargetTx.amount?.toFixed(2)} {disputeTargetTx.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className={`font-mono text-[10px] font-bold ${disputeTargetTx.mode === 'simulation' ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {disputeTargetTx.mode?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Customer Complaint Form */}
            <div className="space-y-2 text-xs">
              <label className="block text-slate-300 font-medium">Customer Claim / Dispute Description</label>
              <textarea
                rows={2}
                value={customerClaim}
                onChange={(e) => setCustomerClaim(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-rose-500 text-xs"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-500">Quick claims:</span>
                <button
                  onClick={() => setCustomerClaim('The order was charged twice on my statement.')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300"
                >
                  Duplicate Charge
                </button>
                <button
                  onClick={() => setCustomerClaim('Received defective equipment unit in delivery.')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300"
                >
                  Damaged Goods
                </button>
                <button
                  onClick={() => setCustomerClaim('Order never arrived.')}
                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-slate-300"
                >
                  Non-Delivery
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleRunTriage}
                  disabled={triageLoading || !customerClaim.trim()}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50"
                >
                  {triageLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Evaluate Claim with AI</span>
                </button>
              </div>
            </div>

            {/* Triage Findings */}
            {triageResult && (
              <div className="p-4 bg-slate-950 border border-indigo-900/40 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 font-bold text-white font-heading">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <span>AI Analysis: {triageResult.classification}</span>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded font-mono text-[10px]">
                    Confidence: {(triageResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {triageResult.explanation}
                </p>

                <div className="p-2.5 bg-slate-900/40 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">Audit Proof & Ledger Evidence:</span>
                  <ul className="list-disc list-inside text-[11px] text-slate-300 space-y-0.5 pl-1">
                    {triageResult.evidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>

                {/* Refund Action Section */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Authorized Refund Processing</span>
                    <span className={`text-[11px] font-bold ${triageResult.eligibleForRefund ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {triageResult.eligibleForRefund
                        ? `Eligible up to $${triageResult.maxRefundableAmount?.toFixed(2)}`
                        : 'Not eligible for refund'}
                    </span>
                  </div>

                  {triageResult.eligibleForRefund ? (
                    <div className="space-y-3 bg-slate-900 p-3 rounded-xl border border-slate-800">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Refund Amount ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            max={triageResult.maxRefundableAmount}
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs focus:outline-none focus:border-rose-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">Refund Reason Note</label>
                          <input
                            type="text"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleExecuteRefund}
                          disabled={refundLoading || !parseFloat(refundAmount)}
                          className="flex items-center space-x-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50"
                        >
                          {refundLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          <span>Execute Authorized Refund</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-900/60 rounded-lg text-slate-400 text-[11px]">
                      This transaction is either already fully refunded or does not contain an active eligible capture.
                    </div>
                  )}

                  {refundError && (
                    <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300">
                      {refundError}
                    </div>
                  )}

                  {refundSuccess && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg text-emerald-300 space-y-1">
                      <div className="flex items-center space-x-1 font-bold">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Refund Executed Successfully!</span>
                      </div>
                      <div className="font-mono text-[11px]">
                        Refund ID: {refundSuccess.refundId} | Amount: ${refundSuccess.amount?.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowDisputeModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Close Resolver
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
