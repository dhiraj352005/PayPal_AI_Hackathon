import { z } from 'zod';

export const procurementSchema = z.object({
  prompt: z.string().min(3, 'Purchasing prompt must be at least 3 characters long.').max(2000),
  maxBudget: z.number().positive('Budget must be greater than zero.').max(100000).default(3500)
});

export const contractInvoiceSchema = z.object({
  contractText: z.string().min(5, 'Contract or meeting notes text must be at least 5 characters long.').max(15000),
  recipientEmail: z.string().email('Invalid recipient email format.').optional().or(z.literal(''))
});

export const disputeTriageSchema = z.object({
  orderId: z.string().min(3, 'A valid transaction ID is required.'),
  customerClaim: z.string().min(3, 'Customer claim description must be at least 3 characters long.').max(3000)
});

export const createOrderSchema = z.object({
  items: z.array(
    z.object({
      sku: z.string().min(1, 'Product SKU is required'),
      quantity: z.number().int().positive('Quantity must be an integer greater than zero.')
    })
  ).min(1, 'Order must contain at least one item.'),
  currency: z.string().length(3).default('USD'),
  useSimulation: z.boolean().optional().default(false),
  customer: z.object({
    name: z.string().optional(),
    email: z.string().email().optional()
  }).optional()
});

export const captureOrderSchema = z.object({
  orderId: z.string().min(3, 'Valid Order ID is required.')
});

export const createInvoiceSchema = z.object({
  recipientName: z.string().min(1, 'Recipient name is required.'),
  recipientEmail: z.string().email('Valid recipient email address is required.'),
  invoiceTitle: z.string().max(200).optional(),
  lineItems: z.array(
    z.object({
      name: z.string().min(1, 'Line item name is required.'),
      description: z.string().optional().default(''),
      quantity: z.number().positive('Quantity must be positive.'),
      unitPrice: z.number().nonnegative('Unit price must be non-negative.')
    })
  ).min(1, 'Invoice must contain at least one line item.'),
  currency: z.string().length(3).default('USD'),
  taxPercentage: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
  paymentTerms: z.string().optional(),
  sendImmediately: z.boolean().default(false),
  useSimulation: z.boolean().default(false)
});

export const refundSchema = z.object({
  captureId: z.string().min(3, 'Capture ID is required for a refund.'),
  amount: z.number().positive('Refund amount must be greater than 0.'),
  reason: z.string().max(500).optional().default('Customer requested refund')
});

export const updateCredentialsSchema = z.object({
  paypalClientId: z.string().optional(),
  paypalClientSecret: z.string().optional(),
  geminiApiKey: z.string().optional(),
  adminSecret: z.string().min(1, 'Admin secret is required to authorize credential modification.')
});
