import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  Sparkles,
  ShoppingCart,
  DollarSign,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';

export default function ProcurementPage({ systemStatus }) {
  const [prompt, setPrompt] = useState('Equip five remote developers with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500.');
  const [budget, setBudget] = useState(3500);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [agentResult, setAgentResult] = useState(null);
  
  // Cart items in AG Grid
  const [cartItems, setCartItems] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [showCatalogModal, setShowCatalogModal] = useState(false);

  // PayPal Order & Checkout state
  const [orderLoading, setOrderLoading] = useState(false);
  const [createdOrder, setCreatedOrder] = useState(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [capturedPayment, setCapturedPayment] = useState(null);
  const [checkoutError, setCheckoutError] = useState(null);

  const gridRef = useRef();

  // Load catalog on mount
  useEffect(() => {
    api.getCatalog().then(res => {
      if (res.catalog) setCatalog(res.catalog);
    }).catch(console.error);
  }, []);

  // Compute live subtotal from cart
  const cartSubtotal = useMemo(() => {
    return Number(cartItems.reduce((acc, item) => acc + (item.unitPrice * (item.quantity || 1)), 0).toFixed(2));
  }, [cartItems]);

  const remainingBudget = Number((budget - cartSubtotal).toFixed(2));
  const isBudgetExceeded = remainingBudget < 0;

  // Run AI Procurement Agent
  async function handleRunAgent() {
    setLoadingAgent(true);
    setCreatedOrder(null);
    setCapturedPayment(null);
    setCheckoutError(null);

    try {
      const res = await api.runProcurement({ prompt, maxBudget: budget });
      setAgentResult(res);
      setCartItems(res.selectedCatalogItems || []);
    } catch (err) {
      alert(`Procurement error: ${err.message}`);
    } finally {
      setLoadingAgent(false);
    }
  }

  // AG Grid column definitions
  const columnDefs = useMemo(() => [
    {
      field: 'sku',
      headerName: 'SKU',
      width: 140,
      cellClass: 'font-mono text-xs text-indigo-300 font-medium'
    },
    {
      field: 'name',
      headerName: 'Product Name',
      flex: 2,
      minWidth: 220,
      cellClass: 'text-xs font-medium text-slate-200'
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 150,
      cellClass: 'text-xs text-slate-400'
    },
    {
      field: 'unitPrice',
      headerName: 'Unit Price',
      width: 110,
      valueFormatter: params => `$${params.value?.toFixed(2)}`,
      cellClass: 'text-xs text-right font-medium text-slate-300'
    },
    {
      field: 'quantity',
      headerName: 'Qty',
      width: 90,
      editable: true,
      cellEditor: 'agNumberCellEditor',
      cellClass: 'text-xs text-center font-bold text-amber-300 bg-slate-900/60'
    },
    {
      headerName: 'Subtotal',
      width: 120,
      valueGetter: params => {
        const qty = Number(params.data.quantity) || 1;
        const price = Number(params.data.unitPrice) || 0;
        return Number((qty * price).toFixed(2));
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
            onClick={() => handleRemoveItem(params.data.sku)}
            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
            title="Remove item"
          >
            <Trash2 className="w-4 h-4 mt-1" />
          </button>
        );
      }
    }
  ], []);

  function handleCellValueChanged(params) {
    const updatedData = [...cartItems];
    const index = updatedData.findIndex(item => item.sku === params.data.sku);
    if (index !== -1) {
      const newQty = Math.max(1, parseInt(params.newValue, 10) || 1);
      updatedData[index].quantity = newQty;
      updatedData[index].subtotal = Number((updatedData[index].unitPrice * newQty).toFixed(2));
      setCartItems(updatedData);
    }
  }

  function handleRemoveItem(sku) {
    setCartItems(prev => prev.filter(i => i.sku !== sku));
  }

  function handleAddCatalogItem(product) {
    setCartItems(prev => {
      const exists = prev.find(i => i.sku === product.sku);
      if (exists) {
        return prev.map(i => i.sku === product.sku ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice } : i);
      }
      return [...prev, {
        sku: product.sku,
        name: product.name,
        category: product.category,
        supplier: product.supplier,
        unitPrice: product.unitPrice,
        quantity: 1,
        subtotal: product.unitPrice
      }];
    });
    setShowCatalogModal(false);
  }

  // Create PayPal Order
  async function handleCreatePayPalOrder() {
    if (cartItems.length === 0) {
      alert('Cart is empty. Please add items to create an order.');
      return;
    }
    setOrderLoading(true);
    setCheckoutError(null);
    setCreatedOrder(null);
    setCapturedPayment(null);

    try {
      const payload = {
        items: cartItems.map(i => ({ sku: i.sku, quantity: i.quantity })),
        currency: 'USD',
        useSimulation: !systemStatus?.paypalConnected
      };
      const res = await api.createPayPalOrder(payload);
      setCreatedOrder(res);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setOrderLoading(false);
    }
  }

  // Capture Order
  async function handleCaptureOrder() {
    if (!createdOrder?.orderId) return;
    setCaptureLoading(true);
    setCheckoutError(null);

    try {
      const res = await api.capturePayPalOrder(createdOrder.orderId);
      setCapturedPayment(res);
    } catch (err) {
      setCheckoutError(err.message);
    } finally {
      setCaptureLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-paypal-lightBlue text-xs font-semibold uppercase tracking-wider">
            <ShoppingCart className="w-4 h-4" />
            <span>Buyer Workflow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Agentic Procurement Workspace
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Describe workplace specifications in plain English. PayFlow AI verifies inventory against trusted B2B catalogs, enforces strict budget guardrails, and creates authorized PayPal orders.
          </p>
        </div>
      </div>

      {/* Request Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">
            Natural-Language Purchasing Requirement
          </label>
          <div className="relative">
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Equip five remote developers with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500..."
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm leading-relaxed"
            />
          </div>
        </div>

        {/* Budget Slider & Preset Scenarios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-slate-300">Procurement Budget Cap:</span>
              <span className="font-heading font-bold text-lg text-emerald-400">${budget.toLocaleString()} USD</span>
            </div>
            <input
              type="range"
              min="500"
              max="25000"
              step="100"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer h-2 bg-slate-950 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>$500</span>
              <span>$10,000</span>
              <span>$25,000</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-300 mb-2">Preset Benchmark Scenarios:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setPrompt('Equip five remote developers with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500.');
                  setBudget(3500);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors"
              >
                💼 5-Person Dev Team ($3,500)
              </button>
              <button
                onClick={() => {
                  setPrompt('Set up a podcast and livestream studio for a marketing team under $1,800.');
                  setBudget(1800);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors"
              >
                🎙️ Podcast Studio ($1,800)
              </button>
              <button
                onClick={() => {
                  setPrompt('Procure ten ergonomic office chairs and standing desk converters under $4,500.');
                  setBudget(4500);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 transition-colors"
              >
                🪑 10 Ergonomic Workstations ($4,500)
              </button>
            </div>
          </div>
        </div>

        {/* Trigger Button */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleRunAgent}
            disabled={loadingAgent || !prompt.trim()}
            className="flex items-center space-x-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-paypal-blue hover:from-indigo-500 hover:to-paypal-lightBlue text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
          >
            {loadingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>Analyze Intent & Optimize Bundle</span>
          </button>
        </div>
      </div>

      {/* AI Reasoning Card */}
      {agentResult && (
        <div className="bg-slate-900/80 border border-indigo-950/60 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white font-heading">AI Procurement Evaluation & Rationale</h3>
            </div>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
              agentResult.mode === 'live'
                ? 'bg-indigo-950/70 text-indigo-300 border-indigo-800'
                : 'bg-blue-950/70 text-blue-300 border-blue-800'
            }`}>
              {agentResult.mode === 'live' ? 'Generated via Gemini 2.5' : 'Deterministic B2B Optimizer'}
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {agentResult.reasoningSummary}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Allocated Total</span>
              <span className="text-white font-bold font-mono text-sm">${agentResult.totalCost?.toFixed(2)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Budget Surplus</span>
              <span className="text-emerald-400 font-bold font-mono text-sm">${agentResult.remainingBudget?.toFixed(2)}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Budget Savings</span>
              <span className="text-indigo-400 font-bold font-mono text-sm">{agentResult.savingsPercentage}%</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 text-[11px] block">Items Matched</span>
              <span className="text-slate-200 font-bold font-mono text-sm">{cartItems.length} lines</span>
            </div>
          </div>

          {agentResult.unmetRequirements?.length > 0 && (
            <div className="mt-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-amber-300 text-[11px] space-y-1">
              <div className="font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Trade-offs & Constraints:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-200/90 pl-1">
                {agentResult.unmetRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AG Grid Cart Workspace */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white font-heading">
              Editable Procurement Cart
            </h2>
            <p className="text-xs text-slate-400">
              Double-click quantity cells in the table below to edit quantities. Subtotals update instantly with verified B2B catalog unit prices.
            </p>
          </div>
          <button
            onClick={() => setShowCatalogModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add from Catalog</span>
          </button>
        </div>

        {/* AG Grid Container */}
        <div className="ag-theme-quartz-dark w-full h-72 rounded-xl overflow-hidden border border-slate-800">
          <AgGridReact
            ref={gridRef}
            rowData={cartItems}
            columnDefs={columnDefs}
            onCellValueChanged={handleCellValueChanged}
            suppressCellFocus={false}
            animateRows={true}
            overlayNoRowsTemplate="<span class='text-slate-500 text-xs'>No items in procurement cart. Run the AI Agent above or add items from the catalog.</span>"
          />
        </div>

        {/* Financial Summary Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-[11px] text-slate-500 block">Cart Total</span>
              <span className="text-lg font-bold font-mono text-white">${cartSubtotal.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 block">Remaining Budget</span>
              <span className={`text-lg font-bold font-mono ${isBudgetExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                ${remainingBudget.toFixed(2)}
              </span>
            </div>
          </div>

          {isBudgetExceeded ? (
            <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold bg-rose-950/40 px-3 py-2 rounded-lg border border-rose-800/60">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Budget exceeded by ${Math.abs(remainingBudget).toFixed(2)}. Adjust quantities to proceed.</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400">
              <span className="text-emerald-400 font-medium">✓ Order is within authorized ${budget.toLocaleString()} budget.</span>
            </div>
          )}
        </div>
      </div>

      {/* Checkout Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-paypal-blue" />
            <h2 className="text-base font-bold text-white font-heading">
              PayPal Enterprise Checkout
            </h2>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
            systemStatus?.paypalConnected
              ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800'
              : 'bg-amber-950/50 text-amber-300 border-amber-800'
          }`}>
            {systemStatus?.paypalConnected ? 'PayPal Sandbox Ready' : 'Simulation Mode Active'}
          </span>
        </div>

        {checkoutError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs">
            {checkoutError}
          </div>
        )}

        {/* Step 1: Create Order */}
        {!createdOrder && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400">
              Creates an authentic PayPal Sandbox Order with verified line items and sets intent to <span className="text-white font-mono">CAPTURE</span>.
            </p>
            <button
              onClick={handleCreatePayPalOrder}
              disabled={orderLoading || cartItems.length === 0 || isBudgetExceeded}
              className="flex items-center space-x-2 px-6 py-2.5 bg-paypal-blue hover:bg-paypal-lightBlue text-white font-semibold rounded-xl shadow-md transition-all disabled:opacity-50 shrink-0"
            >
              {orderLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Generate PayPal Order</span>
            </button>
          </div>
        )}

        {/* Step 2: Order Created - Display Approval Link & Capture */}
        {createdOrder && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Official PayPal Order ID</span>
                <span className="font-mono text-sm font-bold text-paypal-lightBlue">{createdOrder.orderId}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Status: {createdOrder.status}
                </span>
                <span className="font-mono text-xs text-slate-400">${createdOrder.amount?.toFixed(2)} USD</span>
              </div>
            </div>

            {createdOrder.mode === 'simulation' && (
              <div className="p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-300 text-xs">
                ⚠️ <span className="font-semibold">SIMULATION — NOT A REAL PAYPAL TRANSACTION.</span> Order recorded in simulation ledger.
              </div>
            )}

            {/* Approval instructions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-300 space-y-1">
                {createdOrder.approvalUrl ? (
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <span>Buyer Approval URL:</span>
                    <a
                      href={createdOrder.approvalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-paypal-lightBlue hover:underline flex items-center space-x-1 font-mono text-[11px]"
                    >
                      <span>Open PayPal Sandbox Checkout</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : null}
                <p className="text-[11px] text-slate-500">
                  After approving in Sandbox (or in simulation mode), trigger backend payment capture.
                </p>
              </div>

              {!capturedPayment && (
                <button
                  onClick={handleCaptureOrder}
                  disabled={captureLoading}
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 shrink-0"
                >
                  {captureLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Capture Payment on Backend</span>
                </button>
              )}
            </div>

            {/* Step 3: Capture Successful */}
            {capturedPayment && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-xl space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Payment Captured Successfully!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Capture ID:</span>
                    <span className="text-slate-200">{capturedPayment.captureId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className="text-emerald-300">{capturedPayment.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Amount Captured:</span>
                    <span className="text-slate-200">${capturedPayment.amount?.toFixed(2)} USD</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  Transaction recorded in financial ledger. View and audit anytime in the Command Center.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Catalog Search & Add Modal */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white font-heading">Add Items from B2B Catalog</h3>
              <button
                onClick={() => setShowCatalogModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {catalog.map(prod => (
                <div
                  key={prod.sku}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-[11px] text-indigo-400 font-medium">{prod.sku}</span>
                      <span className="text-xs text-white font-medium">{prod.name}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{prod.description}</p>
                    <span className="text-[10px] text-slate-500">Supplier: {prod.supplier} | Stock: {prod.availability}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-sm text-emerald-400">${prod.unitPrice?.toFixed(2)}</div>
                    <button
                      onClick={() => handleAddCatalogItem(prod)}
                      className="mt-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold rounded-lg transition-colors"
                    >
                      + Add to Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
