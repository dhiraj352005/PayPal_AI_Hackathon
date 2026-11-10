import { getLedgerRecords, getLedgerRecordById } from '../services/ledgerService.js';

export async function listLedgerHandler(req, res, next) {
  try {
    const { search, type, mode, page, limit } = req.query;
    const result = await getLedgerRecords({
      search,
      type,
      mode,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
}

export async function getLedgerRecordHandler(req, res, next) {
  try {
    const record = await getLedgerRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Transaction record not found' });
    }
    res.json({ success: true, record });
  } catch (error) {
    next(error);
  }
}
