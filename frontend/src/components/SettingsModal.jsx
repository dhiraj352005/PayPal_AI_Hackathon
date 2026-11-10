import React, { useState } from 'react';
import { X, Key, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Lock, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

export default function SettingsModal({ isOpen, onClose, systemStatus, onStatusRefresh }) {
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [adminSecret, setAdminSecret] = useState('payflow-dev-secret');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        adminSecret: adminSecret.trim()
      };
      if (paypalClientId.trim()) payload.paypalClientId = paypalClientId.trim();
      if (paypalClientSecret.trim()) payload.paypalClientSecret = paypalClientSecret.trim();
      if (geminiApiKey.trim()) payload.geminiApiKey = geminiApiKey.trim();

      const res = await api.updateCredentials(payload);
      setSuccessMsg(res.message || 'Credentials updated and validated successfully.');
      setPaypalClientId('');
      setPaypalClientSecret('');
      setGeminiApiKey('');
      if (onStatusRefresh) onStatusRefresh();
    } catch (err) {
      setError(err.message || 'Failed to update credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white font-heading">Provider Configuration & Keys</h3>
              <p className="text-xs text-slate-400">Configure PayPal Sandbox and Google Gemini API credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Overview */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">PayPal Sandbox Status</div>
              <div className="flex items-center space-x-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${systemStatus?.paypalConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className={systemStatus?.paypalConnected ? 'text-emerald-400' : 'text-amber-400'}>
                  {systemStatus?.paypalConnected ? 'Live Sandbox Active' : 'Simulation Mode'}
                </span>
              </div>
              {systemStatus?.clientIdPreview && (
                <div className="mt-1 font-mono text-[10px] text-slate-500">
                  ID: {systemStatus.clientIdPreview}
                </div>
              )}
            </div>

            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400 mb-1">Gemini AI Status</div>
              <div className="flex items-center space-x-1.5 font-medium">
                <span className={`w-2 h-2 rounded-full ${systemStatus?.geminiConfigured ? 'bg-indigo-400' : 'bg-blue-400'}`}></span>
                <span className={systemStatus?.geminiConfigured ? 'text-indigo-400' : 'text-blue-400'}>
                  {systemStatus?.geminiConfigured ? systemStatus.geminiModel : 'Deterministic Fallback'}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {systemStatus?.geminiConfigured ? 'Live AI reasoning enabled' : 'Catalog optimizer active'}
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-start space-x-2 text-rose-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 flex items-start space-x-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1">PayPal Sandbox Client ID</label>
            <input
              type="text"
              placeholder="e.g. A21AAK..."
              value={paypalClientId}
              onChange={(e) => setPaypalClientId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-paypal-blue"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">PayPal Sandbox Client Secret</label>
            <input
              type="password"
              placeholder="Enter client secret"
              value={paypalClientSecret}
              onChange={(e) => setPaypalClientSecret(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-paypal-blue"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Google Gemini API Key</label>
            <input
              type="password"
              placeholder="Enter Gemini API key"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-400 font-medium">Admin Authorization Secret</label>
              <span className="text-[10px] text-slate-500">Default dev key: payflow-dev-secret</span>
            </div>
            <input
              type="password"
              required
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-slate-500 font-mono"
            />
          </div>

          <div className="pt-3 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Validate & Save Keys</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
