import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEDGER_FILE = path.resolve(__dirname, '../data/ledger.json');

// Memory lock / serialization queue to ensure atomic writes
let writeQueue = Promise.resolve();

/**
 * Initialize ledger file if missing or empty
 */
export async function initializeLedger() {
  try {
    const exists = await fs.access(LEDGER_FILE).then(() => true).catch(() => false);
    if (!exists) {
      await fs.mkdir(path.dirname(LEDGER_FILE), { recursive: true });
      await fs.writeFile(LEDGER_FILE, JSON.stringify([], null, 2), 'utf-8');
    } else {
      const content = await fs.readFile(LEDGER_FILE, 'utf-8');
      if (!content.trim()) {
        await fs.writeFile(LEDGER_FILE, JSON.stringify([], null, 2), 'utf-8');
      }
    }
  } catch (error) {
    console.error('[LedgerService] Failed to initialize ledger file:', error);
  }
}

/**
 * Read all ledger records safely
 */
export async function getLedgerRecords({ search, type, mode, page = 1, limit = 50 } = {}) {
  await initializeLedger();
  try {
    const content = await fs.readFile(LEDGER_FILE, 'utf-8');
    let records = [];
    try {
      records = JSON.parse(content);
      if (!Array.isArray(records)) {
        records = [];
      }
    } catch {
      console.error('[LedgerService] Ledger file corrupted, reading as empty array');
      records = [];
    }

    // Sort descending by createdAt
    records.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    // Filter by type
    if (type && type !== 'ALL') {
      records = records.filter(r => r.type?.toUpperCase() === type.toUpperCase());
    }

    // Filter by mode (real vs simulation)
    if (mode && mode !== 'ALL') {
      records = records.filter(r => r.mode?.toLowerCase() === mode.toLowerCase());
    }

    // Text search across ID, description, providerId, customer name/email
    if (search && search.trim()) {
      const query = search.trim().toLowerCase();
      records = records.filter(r => {
        return (
          r.id?.toLowerCase().includes(query) ||
          r.providerId?.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query) ||
          r.orderId?.toLowerCase().includes(query) ||
          r.captureId?.toLowerCase().includes(query) ||
          r.customer?.name?.toLowerCase().includes(query) ||
          r.customer?.email?.toLowerCase().includes(query)
        );
      });
    }

    const total = records.length;
    const startIndex = (page - 1) * limit;
    const paginatedRecords = records.slice(startIndex, startIndex + limit);

    return {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit) || 1,
      records: paginatedRecords
    };
  } catch (error) {
    console.error('[LedgerService] Error fetching ledger records:', error);
    return { total: 0, page: 1, limit, totalPages: 1, records: [] };
  }
}

/**
 * Find record by ID or Provider ID
 */
export async function getLedgerRecordById(id) {
  await initializeLedger();
  try {
    const content = await fs.readFile(LEDGER_FILE, 'utf-8');
    const records = JSON.parse(content);
    return records.find(r => r.id === id || r.providerId === id || r.orderId === id || r.captureId === id) || null;
  } catch (error) {
    console.error(`[LedgerService] Error finding record ${id}:`, error);
    return null;
  }
}

/**
 * Atomic write helper to safely append or update a record
 */
export async function addLedgerRecord(record) {
  await initializeLedger();

  // Chain to writeQueue to serialize disk writes
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const content = await fs.readFile(LEDGER_FILE, 'utf-8');
        let records = [];
        try {
          records = JSON.parse(content);
        } catch {
          records = [];
        }

        const now = new Date().toISOString();
        const newRecord = {
          ...record,
          id: record.id || `TX-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          createdAt: record.createdAt || now,
          updatedAt: now
        };

        // Check if updating existing record
        const existingIndex = records.findIndex(r => r.id === newRecord.id || (newRecord.providerId && r.providerId === newRecord.providerId));
        if (existingIndex >= 0) {
          records[existingIndex] = { ...records[existingIndex], ...newRecord };
        } else {
          records.unshift(newRecord);
        }

        // Atomic write via temp file
        const tempPath = `${LEDGER_FILE}.${Date.now()}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(records, null, 2), 'utf-8');
        await fs.rename(tempPath, LEDGER_FILE);

        resolve(newRecord);
      } catch (err) {
        console.error('[LedgerService] Failed to write ledger record:', err);
        reject(err);
      }
    });
  });
}

/**
 * Update an existing record status
 */
export async function updateLedgerRecord(id, updates) {
  return new Promise((resolve, reject) => {
    writeQueue = writeQueue.then(async () => {
      try {
        const content = await fs.readFile(LEDGER_FILE, 'utf-8');
        let records = JSON.parse(content);
        const index = records.findIndex(r => r.id === id || r.providerId === id);
        if (index === -1) {
          throw new Error(`Record with ID ${id} not found in ledger`);
        }

        records[index] = {
          ...records[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };

        const tempPath = `${LEDGER_FILE}.${Date.now()}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(records, null, 2), 'utf-8');
        await fs.rename(tempPath, LEDGER_FILE);

        resolve(records[index]);
      } catch (err) {
        reject(err);
      }
    });
  });
}
