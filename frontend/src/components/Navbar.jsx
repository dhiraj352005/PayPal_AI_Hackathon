import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShoppingCart,
  FileText,
  BarChart3,
  Settings,
  ShieldCheck,
  Cpu,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function Navbar({ systemStatus, onOpenSettings }) {
  const isPaypalLive = Boolean(systemStatus?.paypalConnected);
  const isGeminiLive = Boolean(systemStatus?.geminiConfigured);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-paypal-blue to-indigo-600 flex items-center justify-center shadow-lg shadow-paypal-blue/20">
              <span className="font-heading font-extrabold text-white text-xl tracking-tight">P</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-heading font-bold text-lg text-white tracking-tight">PayFlow<span className="text-paypal-lightBlue">.AI</span></span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded">BETA</span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Autonomous Fintech & Invoicing</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <ShoppingCart className="w-4 h-4 text-paypal-lightBlue" />
              <span>Procurement</span>
            </NavLink>

            <NavLink
              to="/invoicing"
              className={({ isActive }) =>
                `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Contract-to-Invoice</span>
            </NavLink>

            <NavLink
              to="/command-center"
              className={({ isActive }) =>
                `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`
              }
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Command Center</span>
            </NavLink>
          </nav>

          {/* Status Badges & Settings Trigger */}
          <div className="flex items-center space-x-2.5">
            {/* PayPal Sandbox Status Badge */}
            <div
              title={isPaypalLive ? 'Connected to live PayPal Sandbox' : 'Operating in Simulation Mode'}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isPaypalLive
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60'
                  : 'bg-amber-950/50 text-amber-300 border-amber-800/50'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isPaypalLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              <span className="font-mono text-[11px]">{isPaypalLive ? 'PayPal: Sandbox' : 'PayPal: Simulation'}</span>
            </div>

            {/* Gemini AI Status Badge */}
            <div
              title={isGeminiLive ? `Gemini AI: ${systemStatus?.geminiModel || 'Live'}` : 'Gemini Key Not Set: Deterministic Fallback Active'}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                isGeminiLive
                  ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                  : 'bg-blue-950/40 text-blue-300 border-blue-800/40'
              }`}
            >
              <Cpu className="w-3 h-3 text-indigo-400" />
              <span className="font-mono text-[11px]">{isGeminiLive ? 'Gemini 2.5' : 'AI Fallback'}</span>
            </div>

            {/* Settings Trigger */}
            <button
              onClick={onOpenSettings}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Configure Keys</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
