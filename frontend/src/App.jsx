import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import Navbar from './components/Navbar';
import DemoBanner from './components/DemoBanner';
import SettingsModal from './components/SettingsModal';
import ProcurementPage from './pages/ProcurementPage';
import InvoicingPage from './pages/InvoicingPage';
import CommandCenterPage from './pages/CommandCenterPage';
import { api } from './services/api';

export default function App() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();

  // Load system configuration status on mount
  async function refreshSystemStatus() {
    try {
      const status = await api.getHealth();
      setSystemStatus(status);
    } catch (err) {
      console.warn('Backend connection pending or offline:', err.message);
      setSystemStatus({
        status: 'warning',
        paypalConnected: false,
        paypalMode: 'sandbox',
        geminiConfigured: false,
        message: 'Could not connect to backend. Please ensure backend server is running.'
      });
    }
  }

  useEffect(() => {
    refreshSystemStatus();
  }, []);

  function handleDemoPromptSelect(promptText, budget) {
    navigate('/');
    // Could dispatch custom event or pass via state
  }

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test';

  return (
    <PayPalScriptProvider options={{ clientId: paypalClientId, currency: 'USD', intent: 'capture' }}>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
        
        {/* Navigation Bar */}
        <Navbar
          systemStatus={systemStatus}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Hackathon Judge Demo Banner */}
        <DemoBanner
          onSelectPrompt={handleDemoPromptSelect}
          isSimulationMode={!systemStatus?.paypalConnected}
        />

        {/* Main Content Workspace */}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ProcurementPage systemStatus={systemStatus} />} />
            <Route path="/invoicing" element={<InvoicingPage systemStatus={systemStatus} />} />
            <Route path="/command-center" element={<CommandCenterPage systemStatus={systemStatus} />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-400">PayFlow AI</span> — Built for the PayPal AI Hackathon: <span className="italic">"Build What's Next with PayPal and AI"</span>
            </div>
            <div className="flex items-center space-x-3 text-[11px]">
              <span>PayPal Sandbox REST v2</span>
              <span>•</span>
              <span>Google Gemini AI</span>
              <span>•</span>
              <span>MIT License</span>
            </div>
          </div>
        </footer>

        {/* Secure Settings / Keys Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          systemStatus={systemStatus}
          onStatusRefresh={refreshSystemStatus}
        />

      </div>
    </PayPalScriptProvider>
  );
}
