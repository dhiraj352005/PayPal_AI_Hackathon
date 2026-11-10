import { createOrder, captureOrder, createAndSendInvoice, refundCapture } from '../services/paypalService.js';
import { createOrderSchema, captureOrderSchema, createInvoiceSchema, refundSchema } from '../validators/schemas.js';

export async function createOrderHandler(req, res, next) {
  try {
    const validated = createOrderSchema.parse(req.body);
    const result = await createOrder(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order request',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}

export async function captureOrderHandler(req, res, next) {
  try {
    const orderId = req.params.orderId;
    captureOrderSchema.parse({ orderId });
    const result = await captureOrder(orderId);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}

export async function createInvoiceHandler(req, res, next) {
  try {
    const validated = createInvoiceSchema.parse(req.body);
    const result = await createAndSendInvoice(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid invoice request',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}

export async function refundHandler(req, res, next) {
  try {
    const captureId = req.params.captureId;
    const { amount, reason } = req.body;
    const validated = refundSchema.parse({
      captureId,
      amount: parseFloat(amount),
      reason
    });

    const result = await refundCapture(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid refund parameters',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}
