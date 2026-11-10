import { runProcurementAgent } from '../services/procurementService.js';
import { runContractToInvoiceAgent, runDisputeTriageAgent } from '../services/aiAgentService.js';
import { procurementSchema, contractInvoiceSchema, disputeTriageSchema } from '../validators/schemas.js';

export async function procureHandler(req, res, next) {
  try {
    const validated = procurementSchema.parse(req.body);
    const result = await runProcurementAgent(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid procurement parameters',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}

export async function contractToInvoiceHandler(req, res, next) {
  try {
    const validated = contractInvoiceSchema.parse(req.body);
    const result = await runContractToInvoiceAgent(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid contract text or parameters',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}

export async function disputeTriageHandler(req, res, next) {
  try {
    const validated = disputeTriageSchema.parse(req.body);
    const result = await runDisputeTriageAgent(validated);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid dispute triage parameters',
        errors: error.errors.map(e => e.message)
      });
    }
    next(error);
  }
}
