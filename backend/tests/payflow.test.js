import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog, getProductBySku, validateCartItems } from '../src/services/catalogService.js';
import { optimizeProcurementDeterministic } from '../src/services/procurementService.js';
import { parseContractDeterministic } from '../src/services/aiAgentService.js';
import { getLedgerRecords, addLedgerRecord, getLedgerRecordById } from '../src/services/ledgerService.js';
import { updateCredentials } from '../src/services/configService.js';
import { createOrderSchema, createInvoiceSchema, refundSchema } from '../src/validators/schemas.js';

test('1. Catalog: Load items and lookup by SKU', async () => {
  const catalog = await getCatalog();
  assert.ok(Array.isArray(catalog), 'Catalog should be an array');
  assert.ok(catalog.length >= 30, `Catalog should have at least 30 items, found ${catalog.length}`);

  const sample = await getProductBySku('HW-MON-4K27');
  assert.ok(sample, 'Product HW-MON-4K27 should exist');
  assert.equal(sample.category, 'Monitors');
  assert.equal(typeof sample.unitPrice, 'number');
  assert.ok(sample.unitPrice > 0, 'Unit price must be positive');
});

test('2. Cart Validation: Validates trusted prices and quantities', async () => {
  const validCart = [
    { sku: 'HW-MON-4K27', quantity: 2 },
    { sku: 'HW-KEY-MXMEC', quantity: 2 }
  ];
  const result = await validateCartItems(validCart);
  assert.equal(result.isValid, true);
  assert.equal(result.items.length, 2);
  // 499 * 2 = 998; 149.99 * 2 = 299.98 => Total 1297.98
  assert.equal(result.subtotal, 1297.98);

  // Unknown SKU should fail validation
  const invalidCart = [{ sku: 'NON-EXISTENT-SKU', quantity: 1 }];
  const invalidResult = await validateCartItems(invalidCart);
  assert.equal(invalidResult.isValid, false);
  assert.ok(invalidResult.errors.length > 0);
});

test('3. Procurement: Deterministic optimization respects budget constraint', async () => {
  const prompt = 'Equip five remote developers with 4K monitors, mechanical keyboards, and noise-canceling headsets under $3,500.';
  const budget = 3500;
  const result = await optimizeProcurementDeterministic(prompt, budget);

  assert.equal(result.mode, 'fallback');
  assert.ok(result.selectedCatalogItems.length > 0, 'Must select products');
  assert.ok(result.totalCost <= budget, `Total cost ($${result.totalCost}) must not exceed budget ($${budget})`);
  assert.equal(result.remainingBudget, Number((budget - result.totalCost).toFixed(2)));
  assert.ok(result.savingsPercentage >= 0);
});

test('4. Procurement: Extreme low budget handles unmet constraints gracefully', async () => {
  const prompt = 'Buy 10 high-end laptops and 4K monitors';
  const smallBudget = 400; // Far too small for 10 laptops
  const result = await optimizeProcurementDeterministic(prompt, smallBudget);

  assert.ok(result.totalCost <= smallBudget, 'Must strictly never exceed budget');
  assert.ok(result.unmetRequirements.length > 0, 'Must report unmet requirements');
});

test('5. Contract-to-Invoice: Extracts line items, rates, and 8% tax correctly', () => {
  const sampleContract = `
    Acme Technologies requires 12 hours of React development at $60 per hour,
    four hours of API integration at $75 per hour, and a $150 deployment fee.
    Apply 8% tax. The client contact is accounts@example.com.
  `;
  const result = parseContractDeterministic(sampleContract);

  assert.equal(result.recipientEmail, 'accounts@example.com');
  assert.equal(result.taxPercentage, 8);
  assert.ok(result.lineItems.length >= 3, 'Should extract at least 3 line items');

  // Subtotal: 12*60 (720) + 4*75 (300) + 150 = 1170
  assert.equal(result.subtotal, 1170.00);
  // Tax: 1170 * 0.08 = 93.60
  assert.equal(result.taxAmount, 93.60);
  // Total: 1170 + 93.60 = 1263.60
  assert.equal(result.totalAmount, 1263.60);
});

test('6. Ledger: Reads records, supports search and isolation', async () => {
  const initial = await getLedgerRecords({ limit: 10 });
  assert.ok(Array.isArray(initial.records));
  assert.ok(initial.total >= 4, 'Should contain at least the 4 seeded records');

  // Add a test record
  const testId = `TEST-TX-${Date.now()}`;
  await addLedgerRecord({
    id: testId,
    type: 'ORDER',
    providerId: 'DEMO-ORD-TEST',
    status: 'COMPLETED',
    mode: 'simulation',
    amount: 199.99,
    currency: 'USD',
    description: 'Unit test order'
  });

  const fetched = await getLedgerRecordById(testId);
  assert.ok(fetched, 'Record should be persisted and retrievable');
  assert.equal(fetched.amount, 199.99);
  assert.equal(fetched.mode, 'simulation');
});

test('7. Validation: Zod schemas block invalid requests', () => {
  // Empty items in order
  assert.throws(() => {
    createOrderSchema.parse({ items: [] });
  });

  // Invalid email in invoice
  assert.throws(() => {
    createInvoiceSchema.parse({
      recipientName: 'Test',
      recipientEmail: 'not-an-email',
      lineItems: [{ name: 'Item', quantity: 1, unitPrice: 10 }]
    });
  });

  // Negative refund amount
  assert.throws(() => {
    refundSchema.parse({
      captureId: 'CAP-123',
      amount: -50
    });
  });
});

test('8. Security: Credential update rejects unauthorized attempts', async () => {
  await assert.rejects(
    async () => {
      await updateCredentials({
        paypalClientId: 'test-client-id',
        paypalClientSecret: 'test-client-secret',
        adminSecret: 'WRONG_SECRET'
      });
    },
    /Unauthorized/
  );
});



