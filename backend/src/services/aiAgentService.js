import { generateGeminiContent, isGeminiConfigured } from './geminiService.js';
import { getLedgerRecordById, getLedgerRecords } from './ledgerService.js';

/**
 * Deterministic Contract Parser (Fallback when Gemini is unavailable)
 */
export function parseContractDeterministic(contractText, recipientEmail = '') {
  const lines = contractText.split('\n');
  const items = [];
  let taxPercentage = 0;
  let clientName = 'Acme Corp';
  let dueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]; // Net 14 days
  let paymentTerms = 'Net 15 days upon receipt';
  const missingFields = [];

  // Look for email in text if not provided
  let extractedEmail = recipientEmail;
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const emailMatch = contractText.match(emailRegex);
  if (emailMatch && !extractedEmail) {
    extractedEmail = emailMatch[1];
  }

  if (!extractedEmail) {
    missingFields.push('Recipient email is missing. Please enter the client billing email.');
  }

  // Look for tax
  const taxMatch = contractText.match(/(\d+(?:\.\d+)?)\s*%\s*(?:tax|sales tax|vat)/i);
  if (taxMatch) {
    taxPercentage = parseFloat(taxMatch[1]);
  }

  // Extract client / company name
  const companyPrefixMatch = contractText.match(/^([A-Z][A-Za-z0-9\s&]+?)\s+(?:requires|scope|agreement|contract)\b/i) ||
                             contractText.match(/(?:client|customer|company|agreement with)\s*(?:name|is|:)?\s*([A-Z][A-Za-z0-9\s&]+?)(?:\s+requires|\s+is|\.|\n|,)/i);
  if (companyPrefixMatch) {
    const rawName = companyPrefixMatch[1].trim();
    if (!['contact', 'email', 'name'].includes(rawName.toLowerCase())) {
      clientName = rawName;
    }
  }

  // Split into clauses by punctuation, newline, or coordinating conjunctions
  const clauses = contractText.split(/[,;\n]|\band\b/i).map(c => c.trim()).filter(Boolean);
  const wordMap = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };


  
  for (const clause of clauses) {
    // 1. Hourly rate or quantity items: e.g. "12 hours of React development at $60 per hour"
    const rateMatch = clause.match(/(?:^|.*?)\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*(?:hours?|hrs?|units?|days?)?\s*(?:of)?\s*(.+?)\s*(?:at|@)\s*\$?(\d+(?:\.\d+)?)/i);
    if (rateMatch) {
      const rawQty = rateMatch[1].toLowerCase();
      const qty = parseInt(rawQty, 10) || wordMap[rawQty] || 1;
      let desc = rateMatch[2].replace(/^(?:requires|need|needs)\s+/i, '').trim();
      const price = parseFloat(rateMatch[3]) || 0;
      const sub = Number((qty * price).toFixed(2));
      items.push({
        name: desc.charAt(0).toUpperCase() + desc.slice(1),
        description: `Deliverables: ${desc}`,
        quantity: qty,
        unitPrice: price,
        subtotal: sub
      });
      continue;
    }

    // 2. Flat fees: e.g. "$150 deployment fee" or "deployment fee of $150"
    const flatFeeMatch1 = clause.match(/\$(\d+(?:\.\d+)?)\s+(.+?(?:fee|setup|retainer|charge|onboarding))/i);
    const flatFeeMatch2 = clause.match(/(.+?(?:fee|setup|retainer|charge|onboarding))\s+(?:of\s+)?\$(\d+(?:\.\d+)?)/i);

    if (flatFeeMatch1) {
      const price = parseFloat(flatFeeMatch1[1]);
      const desc = flatFeeMatch1[2].replace(/^(?:a|an)\s+/i, '').trim();
      items.push({
        name: desc.charAt(0).toUpperCase() + desc.slice(1),
        description: `Flat charge: ${desc}`,
        quantity: 1,
        unitPrice: price,
        subtotal: price
      });
    } else if (flatFeeMatch2) {
      const desc = flatFeeMatch2[1].replace(/^(?:a|an)\s+/i, '').trim();
      const price = parseFloat(flatFeeMatch2[2]);
      items.push({
        name: desc.charAt(0).toUpperCase() + desc.slice(1),
        description: `Flat charge: ${desc}`,
        quantity: 1,
        unitPrice: price,
        subtotal: price
      });
    }
  }

  // Default item if none matched
  if (items.length === 0) {
    items.push({
      name: 'Professional Consulting Services',
      description: 'Scope of work as defined in agreement',
      quantity: 1,
      unitPrice: 500.00,
      subtotal: 500.00
    });
    missingFields.push('Specific line items could not be unambiguously parsed. Please review and adjust the line item table.');
  }

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = Number(((subtotal * taxPercentage) / 100).toFixed(2));
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  return {
    mode: 'fallback',
    invoiceTitle: `Invoice for ${clientName} - Professional Services`,
    recipientName: clientName,
    recipientEmail: extractedEmail || '',
    currency: 'USD',
    taxPercentage,
    taxAmount,
    subtotal: Number(subtotal.toFixed(2)),
    totalAmount,
    dueDate,
    paymentTerms,
    notes: 'Thank you for your business. Payment is due as per agreement terms via PayPal.',
    lineItems: items,
    aiSummary: `Parsed ${items.length} line item(s) from document text with ${taxPercentage}% tax rate.`,
    missingFields
  };
}

/**
 * Run Contract-to-Invoice AI Agent
 */
export async function runContractToInvoiceAgent({ contractText, recipientEmail }) {
  if (!contractText || typeof contractText !== 'string' || contractText.trim().length === 0) {
    throw new Error('Contract or scope text is required');
  }

  if (!isGeminiConfigured()) {
    console.info('[InvoiceAgent] Gemini not configured. Using deterministic parser.');
    return parseContractDeterministic(contractText, recipientEmail);
  }

  const systemInstruction = `You are an expert financial contracts parsing agent for PayFlow AI.
Analyze the provided contract, agreement, or meeting notes.
Extract client information, line items, unit prices, quantities, taxes, due date, and terms.
Do NOT invent unmentioned information. If an essential field (like client email or tax) is missing or ambiguous, list it in missingFields.
Always calculate subtotals and totals accurately.

Return strictly a JSON object:
{
  "invoiceTitle": "Title of the invoice",
  "recipientName": "Client or company name",
  "recipientEmail": "Client email if found",
  "currency": "USD",
  "taxPercentage": 8.0,
  "dueDate": "YYYY-MM-DD",
  "paymentTerms": "e.g. Net 15 days upon receipt",
  "notes": "Payment notes or project reference",
  "lineItems": [
    {
      "name": "Line item title",
      "description": "Clear detailed description",
      "quantity": 12,
      "unitPrice": 60.00,
      "subtotal": 720.00
    }
  ],
  "aiSummary": "Brief overview of what was extracted and verified",
  "missingFields": ["Any ambiguous or missing fields requiring user resolution"]
}`;

  try {
    const aiResult = await generateGeminiContent({
      prompt: `Contract Document:\n"${contractText}"\n\nProvided Recipient Email: "${recipientEmail || ''}"`,
      systemInstruction
    });

    const parsed = aiResult.data;

    // Recalculate and validate monetary fields on server
    const lineItems = (parsed.lineItems || []).map(item => {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const price = Math.max(0, parseFloat(item.unitPrice) || 0);
      const sub = Number((qty * price).toFixed(2));
      return {
        name: item.name || 'Service Item',
        description: item.description || '',
        quantity: qty,
        unitPrice: price,
        subtotal: sub
      };
    });

    const subtotal = Number(lineItems.reduce((acc, it) => acc + it.subtotal, 0).toFixed(2));
    const taxPercentage = Math.max(0, parseFloat(parsed.taxPercentage) || 0);
    const taxAmount = Number(((subtotal * taxPercentage) / 100).toFixed(2));
    const totalAmount = Number((subtotal + taxAmount).toFixed(2));

    const missingFields = Array.isArray(parsed.missingFields) ? parsed.missingFields : [];
    const finalEmail = (parsed.recipientEmail || recipientEmail || '').trim();
    if (!finalEmail) {
      missingFields.push('Recipient email is missing. Please provide a recipient email to generate the invoice.');
    }

    return {
      mode: 'live',
      invoiceTitle: parsed.invoiceTitle || 'Services Invoice',
      recipientName: parsed.recipientName || 'Client',
      recipientEmail: finalEmail,
      currency: parsed.currency || 'USD',
      taxPercentage,
      taxAmount,
      subtotal,
      totalAmount,
      dueDate: parsed.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      paymentTerms: parsed.paymentTerms || 'Due upon receipt',
      notes: parsed.notes || 'Generated by PayFlow AI Contract Agent',
      lineItems,
      aiSummary: parsed.aiSummary || 'Successfully extracted contract items with Gemini AI.',
      missingFields
    };
  } catch (err) {
    console.warn('[InvoiceAgent] Gemini error, using fallback parser:', err.message);
    const fallback = parseContractDeterministic(contractText, recipientEmail);
    fallback.note = `AI service unavailable (${err.message}). Deterministic contract parser used.`;
    return fallback;
  }
}

/**
 * Run Dispute Triage AI Agent
 */
export async function runDisputeTriageAgent({ orderId, customerClaim }) {
  if (!orderId) {
    throw new Error('Transaction orderId is required for dispute triage');
  }
  if (!customerClaim || !customerClaim.trim()) {
    throw new Error('Customer claim or complaint description is required');
  }

  // Fetch record and associated records from ledger
  const record = await getLedgerRecordById(orderId);
  if (!record) {
    throw new Error(`Transaction with ID ${orderId} not found in financial ledger`);
  }

  // Fetch any related capture or refund records
  const allRecordsResponse = await getLedgerRecords({ limit: 200 });
  const relatedRecords = allRecordsResponse.records.filter(
    r => r.id === orderId || r.orderId === orderId || r.captureId === orderId || (record.orderId && (r.id === record.orderId || r.orderId === record.orderId))
  );

  const captures = relatedRecords.filter(r => r.type === 'CAPTURE');
  const refunds = relatedRecords.filter(r => r.type === 'REFUND');

  const totalCaptured = captures.reduce((sum, c) => sum + (c.amount || 0), record.type === 'CAPTURE' ? record.amount : 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
  const eligibleRefundAmount = Math.max(0, Number((totalCaptured - totalRefunded).toFixed(2)));

  // If already fully refunded
  const isAlreadyRefunded = totalRefunded >= totalCaptured && totalCaptured > 0;

  const evidence = [
    `Transaction ID: ${record.id}`,
    `Transaction Type: ${record.type}`,
    `Transaction Mode: ${record.mode?.toUpperCase()} (${record.mode === 'simulation' ? 'Simulated DEMO record' : 'Verified PayPal Sandbox'})`,
    `Current Status: ${record.status}`,
    `Transaction Amount: $${record.amount?.toFixed(2)} ${record.currency || 'USD'}`,
    `Recorded Captures: ${captures.length} capture(s) totalling $${totalCaptured.toFixed(2)}`,
    `Recorded Refunds: ${refunds.length} refund(s) totalling $${totalRefunded.toFixed(2)}`,
    `Max Eligible Refund Amount: $${eligibleRefundAmount.toFixed(2)}`
  ];

  if (record.customer?.name) {
    evidence.push(`Customer: ${record.customer.name} (${record.customer.email || 'N/A'})`);
  }

  // Deterministic classification if claim matches specific keywords
  const claimLower = customerClaim.toLowerCase();
  let classification = 'GENERAL_INQUIRY';
  let recommendedNextStep = 'MANUAL_REVIEW';
  let confidence = 0.85;
  let explanation = '';

  if (claimLower.includes('twice') || claimLower.includes('duplicate') || claimLower.includes('double')) {
    classification = 'DUPLICATE_CHARGE_CLAIM';
    if (captures.length > 1) {
      explanation = `Ledger reveals ${captures.length} distinct capture events for this order. Claim is supported by ledger evidence. Recommend refunding the duplicate charge of $${captures[1]?.amount || record.amount}.`;
      recommendedNextStep = 'APPROVE_REFUND';
      confidence = 0.98;
    } else {
      explanation = `Ledger analysis confirms only 1 capture event exists in the financial record ($${record.amount}). No duplicate capture was executed by PayPal. Recommend clarifying statement with customer before refunding.`;
      recommendedNextStep = 'REJECT_DUPLICATE_CLAIM';
      confidence = 0.92;
    }
  } else if (claimLower.includes('defect') || claimLower.includes('broken') || claimLower.includes('damage') || claimLower.includes('not working')) {
    classification = 'DEFECTIVE_OR_DAMAGED_ITEM';
    explanation = 'Customer reports physical defect or damage. In accordance with B2B purchase protection policies, recommend approving partial or full replacement/refund upon item serial verification.';
    recommendedNextStep = eligibleRefundAmount > 0 ? 'APPROVE_PARTIAL_REFUND' : 'ESCALATE_HUMAN_REVIEW';
    confidence = 0.88;
  } else if (claimLower.includes('never received') || claimLower.includes('not delivered') || claimLower.includes('missing')) {
    classification = 'NON_DELIVERY_DISPUTE';
    explanation = 'Customer reports item has not been received. Checking carrier transit status is advised prior to completing full reversal.';
    recommendedNextStep = 'VERIFY_CARRIER_TRACKING';
    confidence = 0.86;
  } else if (claimLower.includes('cancel') || claimLower.includes('return') || claimLower.includes('no longer need')) {
    classification = 'RETURN_OR_BUYER_REMORSE';
    explanation = 'Customer requested return/cancellation. If items are within the 30-day return window, an authorized partial or full refund can be issued.';
    recommendedNextStep = eligibleRefundAmount > 0 ? 'APPROVE_REFUND' : 'REJECT_INELIGIBLE';
    confidence = 0.90;
  } else {
    classification = 'COMMERCIAL_DISPUTE';
    explanation = 'Unusual claim requiring staff inspection. Transaction records are intact.';
    recommendedNextStep = 'ESCALATE_HUMAN_REVIEW';
    confidence = 0.75;
  }

  // If Gemini is configured, enhance classification and reasoning
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = `You are PayFlow AI's dispute triage and risk resolution expert.
Analyze the customer's claim against available transaction ledger evidence.
Provide an objective assessment, classification, recommended next step, and concise explanation.
Never authorize a refund without checking eligibility and never hallucinate facts not in evidence.

Return JSON:
{
  "classification": "DUPLICATE_CHARGE | DEFECTIVE_ITEM | NON_DELIVERY | UNAUTHORIZED | BUYER_REMORSE",
  "explanation": "Clear, objective explanation of findings and policy alignment",
  "recommendedNextStep": "APPROVE_REFUND | APPROVE_PARTIAL_REFUND | REJECT_DUPLICATE_CLAIM | ESCALATE_HUMAN_REVIEW | VERIFY_CARRIER",
  "confidence": 0.95
}`;

      const aiResult = await generateGeminiContent({
        prompt: `Customer Claim: "${customerClaim}"\n\nTransaction Evidence:\n${evidence.join('\n')}`,
        systemInstruction
      });

      if (aiResult.data) {
        classification = aiResult.data.classification || classification;
        explanation = aiResult.data.explanation || explanation;
        recommendedNextStep = aiResult.data.recommendedNextStep || recommendedNextStep;
        confidence = typeof aiResult.data.confidence === 'number' ? aiResult.data.confidence : confidence;
      }
    } catch (aiErr) {
      console.warn('[DisputeTriage] Gemini call failed, using deterministic triage:', aiErr.message);
    }
  }

  return {
    mode: isGeminiConfigured() ? 'live' : 'fallback',
    orderId,
    transactionSnapshot: {
      id: record.id,
      type: record.type,
      providerId: record.providerId,
      status: record.status,
      amount: record.amount,
      currency: record.currency || 'USD',
      mode: record.mode,
      isSample: Boolean(record.isSample)
    },
    classification,
    explanation,
    recommendedNextStep,
    confidence: Number(confidence.toFixed(2)),
    evidence,
    isAlreadyRefunded,
    eligibleForRefund: eligibleRefundAmount > 0 && (record.type === 'CAPTURE' || captures.length > 0),
    maxRefundableAmount: eligibleRefundAmount,
    targetCaptureId: record.type === 'CAPTURE' ? record.id : (captures[0]?.id || null)
  };
}
