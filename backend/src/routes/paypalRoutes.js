import { Router } from 'express';
import {
  createOrderHandler,
  captureOrderHandler,
  createInvoiceHandler,
  refundHandler
} from '../controllers/paypalController.js';

const router = Router();

router.post('/create-order', createOrderHandler);
router.post('/capture-order/:orderId', captureOrderHandler);
router.post('/create-invoice', createInvoiceHandler);
router.post('/refund/:captureId', refundHandler);

export default router;
