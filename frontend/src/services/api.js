const API_BASE = import.meta.env.VITE_API_URL || '';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || (data.errors ? data.errors.join('; ') : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // System Health & Config
  getHealth: () => request('/api/health'),
  updateCredentials: (payload) => request('/api/config/credentials', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Catalog
  getCatalog: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/catalog${q ? `?${q}` : ''}`);
  },

  // Ledger
  getLedger: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/ledger${q ? `?${q}` : ''}`);
  },

  // AI Agents
  runProcurement: ({ prompt, maxBudget }) => request('/api/agent/procure', {
    method: 'POST',
    body: JSON.stringify({ prompt, maxBudget })
  }),

  runContractToInvoice: ({ contractText, recipientEmail }) => request('/api/agent/contract-to-invoice', {
    method: 'POST',
    body: JSON.stringify({ contractText, recipientEmail })
  }),

  runDisputeTriage: ({ orderId, customerClaim }) => request('/api/agent/dispute-triage', {
    method: 'POST',
    body: JSON.stringify({ orderId, customerClaim })
  }),

  // PayPal Transactions
  createPayPalOrder: ({ items, currency = 'USD', useSimulation = false, customer = {} }) => request('/api/paypal/create-order', {
    method: 'POST',
    body: JSON.stringify({ items, currency, useSimulation, customer })
  }),

  capturePayPalOrder: (orderId) => request(`/api/paypal/capture-order/${orderId}`, {
    method: 'POST'
  }),

  createPayPalInvoice: (payload) => request('/api/paypal/create-invoice', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  refundPayment: ({ captureId, amount, reason }) => request(`/api/paypal/refund/${captureId}`, {
    method: 'POST',
    body: JSON.stringify({ amount, reason })
  })
};
