import { addLedgerRecord, updateLedgerRecord, getLedgerRecordById } from './ledgerService.js';
import { validateCartItems } from './catalogService.js';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Returns configuration status of PayPal credentials
 */
export function isPayPalConfigured() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  return Boolean(
    clientId &&
    clientSecret &&
    clientId.trim().length > 10 &&
    clientSecret.trim().length > 10 &&
    !clientId.includes('your_paypal_client_id')
  );
}

/**
 * Get masked client ID for safe client display
 */
export function getMaskedClientId() {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  if (!clientId || clientId.length < 8) return null;
  return `${clientId.substring(0, 4)}••••••••${clientId.substring(clientId.length - 4)}`;
}

/**
 * Reset cached OAuth token (e.g., when credentials change)
 */
export function clearPayPalTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

/**
 * Fetch or reuse OAuth2 Bearer token from PayPal Sandbox
 */
export async function getPayPalAccessToken(customClientId = null, customClientSecret = null) {
  const clientId = customClientId || process.env.PAYPAL_CLIENT_ID;
  const clientSecret = customClientSecret || process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal Client ID or Secret is not configured.');
  }

  // Use cached token if valid for more than 60 seconds
  if (!customClientId && cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const auth = Buffer.from(`${clientId.trim()}:${clientSecret.trim()}`).toString('base64');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'invalid_client') {
        throw new Error('PayPal authentication failed: Invalid Client ID or Client Secret. Check your Sandbox app credentials.');
      }
      throw new Error(data.error_description || data.message || `PayPal OAuth failed with status ${res.status}`);
    }

    if (!customClientId) {
      cachedToken = data.access_token;
      tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    }

    return data.access_token;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('PayPal OAuth request timed out. Please verify network access.');
    }
    throw err;
  }
}

/**
 * Test a pair of PayPal credentials
 */
export async function testPayPalConnection(clientId, clientSecret) {
  try {
    const token = await getPayPalAccessToken(clientId, clientSecret);
    return { success: true, message: 'Successfully authenticated with PayPal Sandbox API.' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * A. Create Order
 * Supports Live PayPal Sandbox or Explicit Simulation Mode
 */
export async function createOrder({ items, currency = 'USD', useSimulation = false, customer = {} }) {
  // Validate items against trusted catalog prices
  const validation = await validateCartItems(items);
  if (!validation.isValid) {
    throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
  }

  const subtotal = validation.subtotal;
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
  const shouldSimulate = useSimulation || !isPayPalConfigured();

  if (shouldSimulate) {
    // Generate transparent simulated order
    const simOrderId = `DEMO-ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const simRecord = await addLedgerRecord({
      id: simOrderId,
      type: 'ORDER',
      providerId: simOrderId,
      status: 'CREATED',
      mode: 'simulation',
      amount: subtotal,
      currency,
      description: `Simulated Procurement Order for ${validation.items.length} item(s)`,
      customer: customer.email ? customer : { name: 'Demo Buyer', email: 'demo.buyer@sandbox.local' },
      items: validation.items,
      approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${simOrderId}`
    });

    return {
      mode: 'simulation',
      orderId: simOrderId,
      status: 'CREATED',
      amount: subtotal,
      currency,
      approvalUrl: simRecord.approvalUrl,
      items: validation.items,
      message: 'SIMULATION — Created simulated procurement order. (No actual PayPal charge)'
    };
  }

  // Live PayPal Sandbox Integration
  const token = await getPayPalAccessToken();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const orderPayload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: `PO-${Date.now()}`,
        description: `PayFlow AI B2B Procurement Order (${validation.items.length} items)`,
        amount: {
          currency_code: currency,
          value: subtotal.toFixed(2),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: subtotal.toFixed(2)
            }
          }
        },
        items: validation.items.map(i => ({
          name: i.name.substring(0, 127),
          sku: i.sku,
          unit_amount: {
            currency_code: currency,
            value: i.unitPrice.toFixed(2)
          },
          quantity: i.quantity.toString(),
          category: 'PHYSICAL_GOODS'
        }))
      }
    ],
    application_context: {
      brand_name: 'PayFlow AI Enterprise',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: `${frontendUrl}/command-center?status=success`,
      cancel_url: `${frontendUrl}/procurement?status=cancelled`
    }
  };

  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(orderPayload)
  });

  const orderData = await res.json();
  if (!res.ok) {
    const errorDetails = orderData.details ? orderData.details.map(d => `${d.issue}: ${d.description}`).join('; ') : orderData.message;
    throw new Error(`PayPal Order Creation failed: ${errorDetails}`);
  }

  const approvalLinkObj = orderData.links?.find(l => l.rel === 'approve');
  const approvalUrl = approvalLinkObj ? approvalLinkObj.href : null;

  // Record in ledger
  await addLedgerRecord({
    id: `ORD-${orderData.id}`,
    type: 'ORDER',
    providerId: orderData.id,
    status: orderData.status,
    mode: 'real',
    amount: subtotal,
    currency,
    description: `Procurement Order (${validation.items.length} items)`,
    customer: customer.email ? customer : { name: 'PayPal Buyer', email: 'sandbox-buyer@paypal.com' },
    items: validation.items,
    approvalUrl
  });

  return {
    mode: 'real',
    orderId: orderData.id,
    status: orderData.status,
    amount: subtotal,
    currency,
    approvalUrl,
    links: orderData.links,
    items: validation.items
  };
}

/**
 * B. Capture Order
 */
export async function captureOrder(orderId) {
  if (!orderId) {
    throw new Error('Order ID is required to capture payment');
  }

  // Handle Simulation capture safely
  if (orderId.startsWith('DEMO-') || orderId.startsWith('DEMO_')) {
    const existing = await getLedgerRecordById(orderId);
    if (!existing) {
      throw new Error(`Simulated order ${orderId} not found in ledger`);
    }

    const simCaptureId = `DEMO-CAP-${Date.now().toString(36).toUpperCase()}`;
    await updateLedgerRecord(existing.id, { status: 'COMPLETED' });

    const captureRecord = await addLedgerRecord({
      id: simCaptureId,
      type: 'CAPTURE',
      providerId: simCaptureId,
      orderId: existing.id,
      status: 'COMPLETED',
      mode: 'simulation',
      amount: existing.amount,
      currency: existing.currency,
      description: `Simulated Capture for ${orderId}`,
      customer: existing.customer
    });

    return {
      mode: 'simulation',
      captureId: simCaptureId,
      orderId,
      status: 'COMPLETED',
      amount: existing.amount,
      currency: existing.currency,
      message: 'SIMULATION — Captured order in simulation ledger. (No real funds transferred)'
    };
  }

  // Live PayPal Capture
  const token = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    }
  });

  const captureData = await res.json();
  if (!res.ok) {
    const details = captureData.details ? captureData.details.map(d => `${d.issue}: ${d.description}`).join('; ') : captureData.message;
    throw new Error(`PayPal Order Capture failed: ${details || captureData.name}`);
  }

  // Extract capture information from purchase units
  const captureObj = captureData.purchase_units?.[0]?.payments?.captures?.[0];
  const realCaptureId = captureObj ? captureObj.id : `CAP-${captureData.id}`;
  const captureStatus = captureObj ? captureObj.status : captureData.status;
  const capturedAmount = captureObj?.amount?.value ? parseFloat(captureObj.amount.value) : 0;
  const capturedCurrency = captureObj?.amount?.currency_code || 'USD';

  // Update original order record
  try {
    await updateLedgerRecord(`ORD-${orderId}`, { status: 'COMPLETED' });
  } catch {
    // Order might have custom key
  }

  // Record capture in ledger
  await addLedgerRecord({
    id: `TX-${realCaptureId}`,
    type: 'CAPTURE',
    providerId: realCaptureId,
    orderId: `ORD-${orderId}`,
    status: captureStatus,
    mode: 'real',
    amount: capturedAmount,
    currency: capturedCurrency,
    description: `PayPal Capture for Order ${orderId}`,
    customer: {
      name: `${captureData.payer?.name?.given_name || ''} ${captureData.payer?.name?.surname || ''}`.trim() || 'PayPal Sandbox Payer',
      email: captureData.payer?.email_address || ''
    }
  });

  return {
    mode: 'real',
    captureId: realCaptureId,
    orderId,
    status: captureStatus,
    amount: capturedAmount,
    currency: capturedCurrency,
    payer: captureData.payer
  };
}

/**
 * C. Create and Send Invoice
 */
export async function createAndSendInvoice({
  recipientName,
  recipientEmail,
  invoiceTitle,
  lineItems,
  currency = 'USD',
  taxPercentage = 0,
  notes = '',
  dueDate = '',
  paymentTerms = '',
  sendImmediately = false,
  useSimulation = false
}) {
  if (!recipientEmail || !recipientEmail.includes('@')) {
    throw new Error('A valid recipient email address is required to create a PayPal invoice.');
  }

  if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
    throw new Error('At least one line item is required.');
  }

  // Compute trusted totals on server
  const items = lineItems.map(item => {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const price = Math.max(0, parseFloat(item.unitPrice) || 0);
    const sub = Number((qty * price).toFixed(2));
    return {
      name: (item.name || 'Service Item').substring(0, 100),
      description: item.description || '',
      quantity: qty,
      unitPrice: price,
      subtotal: sub
    };
  });

  const subtotal = Number(items.reduce((s, it) => s + it.subtotal, 0).toFixed(2));
  const taxPct = Math.max(0, parseFloat(taxPercentage) || 0);
  const taxAmount = Number(((subtotal * taxPct) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  const shouldSimulate = useSimulation || !isPayPalConfigured();

  if (shouldSimulate) {
    const simInvId = `DEMO-INV-${Date.now().toString(36).toUpperCase()}`;
    const invoiceUrl = `https://www.sandbox.paypal.com/invoice/p/#${simInvId}`;
    const status = sendImmediately ? 'SENT' : 'DRAFT';

    const record = await addLedgerRecord({
      id: simInvId,
      type: 'INVOICE',
      providerId: simInvId,
      status,
      mode: 'simulation',
      amount: totalAmount,
      currency,
      description: invoiceTitle || `Invoice for ${recipientName}`,
      customer: { name: recipientName, email: recipientEmail },
      items,
      taxPercentage: taxPct,
      taxAmount,
      invoiceUrl,
      notes,
      paymentTerms
    });

    return {
      mode: 'simulation',
      invoiceId: simInvId,
      invoiceNumber: `DEMO-NUM-${Math.floor(1000 + Math.random() * 9000)}`,
      status,
      amount: totalAmount,
      currency,
      invoiceUrl,
      subtotal,
      taxAmount,
      recipientEmail,
      message: sendImmediately
        ? 'SIMULATION — Simulated invoice generated and marked SENT. (No email dispatched)'
        : 'SIMULATION — Simulated invoice draft created.'
    };
  }

  // Real PayPal Invoicing API
  const token = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  // 1. Generate Next Invoice Number
  let invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  try {
    const numRes = await fetch(`${baseUrl}/v2/invoicing/generate-next-invoice-number`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (numRes.ok) {
      const numData = await numRes.json();
      if (numData.invoice_number) {
        invoiceNumber = numData.invoice_number;
      }
    }
  } catch (numErr) {
    console.warn('[PayPalService] Could not generate invoice number via API, using fallback:', numErr.message);
  }

  // 2. Create Invoice
  const invoicePayload = {
    detail: {
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString().split('T')[0],
      currency_code: currency,
      note: notes || 'Invoice generated via PayFlow AI Autonomous Billing',
      payment_term: {
        term_type: paymentTerms ? 'NET_15' : 'DUE_ON_RECEIPT',
        due_date: dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      }
    },
    invoicer: {
      name: {
        given_name: 'PayFlow AI',
        surname: 'Enterprise'
      }
    },
    primary_recipients: [
      {
        billing_info: {
          name: {
            given_name: recipientName || 'Valued Client'
          },
          email_address: recipientEmail
        }
      }
    ],
    items: items.map(item => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity.toString(),
      unit_amount: {
        currency_code: currency,
        value: item.unitPrice.toFixed(2)
      },
      unit_of_measure: 'QUANTITY',
      tax: taxPct > 0 ? {
        name: 'Sales Tax',
        percent: taxPct.toFixed(2)
      } : undefined
    }))
  };

  const createRes = await fetch(`${baseUrl}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(invoicePayload)
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    const errorDetails = createData.details ? createData.details.map(d => `${d.issue}: ${d.description}`).join('; ') : createData.message;
    throw new Error(`PayPal Invoice Creation Failed: ${errorDetails || createData.name}`);
  }

  const invoiceId = createData.id || createData.href?.split('/').pop();
  let status = createData.status || 'DRAFT';
  let invoiceUrl = `https://www.sandbox.paypal.com/invoice/p/#${invoiceId}`;

  // 3. Send Invoice only if explicit user confirmation
  if (sendImmediately && invoiceId) {
    try {
      const sendRes = await fetch(`${baseUrl}/v2/invoicing/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ send_to_invoicer: false })
      });

      if (sendRes.ok) {
        status = 'SENT';
      } else {
        const sendErr = await sendRes.json();
        console.warn('[PayPalService] Invoice created but send step returned error:', sendErr);
      }
    } catch (sendErr) {
      console.warn('[PayPalService] Failed to dispatch send invoice:', sendErr.message);
    }
  }

  // Record in Ledger
  await addLedgerRecord({
    id: `INV-${invoiceId}`,
    type: 'INVOICE',
    providerId: invoiceId,
    status,
    mode: 'real',
    amount: totalAmount,
    currency,
    description: invoiceTitle || `Invoice for ${recipientName}`,
    customer: { name: recipientName, email: recipientEmail },
    items,
    taxPercentage: taxPct,
    taxAmount,
    invoiceUrl,
    notes,
    paymentTerms
  });

  return {
    mode: 'real',
    invoiceId,
    invoiceNumber,
    status,
    amount: totalAmount,
    currency,
    invoiceUrl,
    subtotal,
    taxAmount,
    recipientEmail
  };
}

/**
 * D. Refund Capture
 */
export async function refundCapture({ captureId, amount, reason = 'Customer requested refund' }) {
  if (!captureId) {
    throw new Error('Capture ID is required to process a refund.');
  }

  const refundAmt = Math.max(0, parseFloat(amount));
  if (isNaN(refundAmt) || refundAmt <= 0) {
    throw new Error('Refund amount must be greater than $0.00');
  }

  // Handle Simulation Refund safely
  if (captureId.startsWith('DEMO-') || captureId.startsWith('DEMO_')) {
    const existing = await getLedgerRecordById(captureId);
    if (!existing) {
      throw new Error(`Simulated capture ${captureId} not found in ledger`);
    }

    if (refundAmt > existing.amount) {
      throw new Error(`Refund amount ($${refundAmt.toFixed(2)}) cannot exceed original capture amount ($${existing.amount.toFixed(2)})`);
    }

    const simRefundId = `DEMO-REF-${Date.now().toString(36).toUpperCase()}`;
    await updateLedgerRecord(existing.id, { status: 'REFUNDED' });

    const refundRecord = await addLedgerRecord({
      id: simRefundId,
      type: 'REFUND',
      providerId: simRefundId,
      captureId: existing.id,
      status: 'COMPLETED',
      mode: 'simulation',
      amount: refundAmt,
      currency: existing.currency || 'USD',
      description: `Simulated Refund for Capture ${captureId}`,
      reason,
      customer: existing.customer
    });

    return {
      mode: 'simulation',
      refundId: simRefundId,
      captureId,
      status: 'COMPLETED',
      amount: refundAmt,
      currency: existing.currency || 'USD',
      reason,
      message: 'SIMULATION — Refund recorded in simulation ledger. (No real funds returned)'
    };
  }

  // Check that real transaction exists and was not simulated
  const realCaptureRecord = await getLedgerRecordById(captureId);
  if (realCaptureRecord && realCaptureRecord.mode === 'simulation') {
    throw new Error('Cannot execute a real PayPal refund against a simulated transaction.');
  }

  // Live PayPal Refund API
  const token = await getPayPalAccessToken();
  const baseUrl = process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';

  const realPaypalCaptureId = captureId.replace(/^TX-/, '');

  const refundPayload = {
    amount: {
      value: refundAmt.toFixed(2),
      currency_code: realCaptureRecord?.currency || 'USD'
    },
    note_to_payer: reason
  };

  const res = await fetch(`${baseUrl}/v2/payments/captures/${realPaypalCaptureId}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(refundPayload)
  });

  const refundData = await res.json();
  if (!res.ok) {
    const errorDetails = refundData.details ? refundData.details.map(d => `${d.issue}: ${d.description}`).join('; ') : refundData.message;
    throw new Error(`PayPal Refund Failed: ${errorDetails || refundData.name}`);
  }

  const refundId = refundData.id;
  const refundStatus = refundData.status || 'COMPLETED';

  // Record refund in ledger
  await addLedgerRecord({
    id: `REF-${refundId}`,
    type: 'REFUND',
    providerId: refundId,
    captureId: `TX-${realPaypalCaptureId}`,
    status: refundStatus,
    mode: 'real',
    amount: refundAmt,
    currency: refundData.amount?.currency_code || 'USD',
    description: `Refund for PayPal Capture ${realPaypalCaptureId}`,
    reason,
    customer: realCaptureRecord?.customer || {}
  });

  return {
    mode: 'real',
    refundId,
    captureId: realPaypalCaptureId,
    status: refundStatus,
    amount: refundAmt,
    currency: refundData.amount?.currency_code || 'USD',
    reason
  };
}
