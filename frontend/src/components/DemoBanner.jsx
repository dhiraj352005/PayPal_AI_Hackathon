import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, HelpCircle, CheckCircle2, Info, ExternalLink } from 'lucide-react';

export default function DemoBanner({ onSelectPrompt, isSimulationMode }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-b border-indigo-900/40 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider font-heading">
              Hackathon Judge Demo Guide & Test Controls
            </span>
            {isSimulationMode && (
              <span className="ml-2 px-2 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">
                SIMULATION MODE ACTIVE (Safe Demo IDs)
              </span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-1 text-xs text-indigo-300 hover:text-indigo-200 transition-colors"
          >
            <span>{isOpen ? 'Collapse Guide' : 'Expand Demo Guide'}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isOpen && (
          <div className="mt-3 pt-3 border-t border-indigo-900/30 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            
            {/* Step 1: Procurement */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-paypal-lightBlue font-medium mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>1. Agentic Procurement</span>
              </div>
              <p className="text-slate-400 leading-relaxed mb-2">
                Input natural-language workplace requirements. The agent extracts constraints and optimizes a bundle strictly from a 32-item trusted catalog.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onSelectPrompt && onSelectPrompt('Equip five remote developers with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500.', 3500)}
                  className="px-2 py-1 bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/50 rounded text-[11px] text-indigo-200 transition-colors"
                >
                  ⚡ Five Devs ($3,500)
                </button>
                <button
                  onClick={() => onSelectPrompt && onSelectPrompt('Set up a podcast and livestream studio for a marketing team under $1,800.', 1800)}
                  className="px-2 py-1 bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/50 rounded text-[11px] text-indigo-200 transition-colors"
                >
                  ⚡ Podcast Studio ($1,800)
                </button>
              </div>
            </div>

            {/* Step 2: Contract-to-Invoice */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-indigo-400 font-medium mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>2. AI Contract-to-Invoice</span>
              </div>
              <p className="text-slate-400 leading-relaxed mb-2">
                Paste raw meeting notes or project scope. The agent parses milestone hours, taxes, rates, and missing fields into an editable AG Grid invoice.
              </p>
              <span className="text-[11px] text-slate-500">
                Supports PayPal Invoicing API dispatch with explicit merchant confirmation.
              </span>
            </div>

            {/* Step 3: Command Center & Dispute */}
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-medium mb-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>3. Command Center & Dispute Triage</span>
              </div>
              <p className="text-slate-400 leading-relaxed mb-2">
                Unified AG Grid ledger with instant CSV export. The AI Dispute Resolver cross-references complaints against ledger proof before authorizing refunds.
              </p>
              <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                <Info className="w-3 h-3 text-amber-400" />
                <span>Real vs. Demo records are strictly isolated.</span>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
